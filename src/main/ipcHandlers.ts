import { BrowserWindow, dialog, ipcMain } from 'electron';
import { IpcMainInvokeEvent } from 'electron/main';

import { loadDatabase } from './utilities/loadDatabase';
import { loadConfig, saveConfig } from './utilities/configStore';
import {
  openOrDownload,
  pickRepoPath,
  setVersionCheckOnOpen,
} from './utilities/docDownload';
import {
  DownloadMode,
  isRunning,
  previewDownloadCounts,
  requestCancel,
  runDownloads,
} from './utilities/runDownloads';
import {
  MAIN_SOURCE,
  checkLatest,
  downloadSource,
  getSource,
  listSources,
  readReleaseInfo,
} from './utilities/databaseSources';
import { store } from './store/mainStore';
import { setDatabase, setDatabaseError } from '../shared/redux/slices/databaseSlice';
import {
  setRepoPath,
  setVersionCheckOnOpen as setVersionCheckOnOpenAction,
  setCheckDatabaseOnStartup as setCheckDatabaseOnStartupAction,
} from '../shared/redux/slices/configSlice';

let startupCheckAttempted = false;

function getActiveWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

async function maybeRunStartupDatabaseCheck(): Promise<void> {
  if (startupCheckAttempted) return;
  startupCheckAttempted = true;

  const config = loadConfig();
  if (config.checkDatabaseOnStartup === false) return;

  const source = MAIN_SOURCE;
  let remote;
  try {
    remote = await checkLatest(source);
  } catch (err) {
    // Network errors etc. — don't bother the user on startup.
    console.warn('Startup database check failed:', err);
    return;
  }

  // Read the on-disk release.json directly — it's the single source of truth
  // about which release we have locally. Falling back to redux state would
  // miss the tag if `setDatabase` was dispatched before this function ran
  // with a slightly stale meta.
  const localInfo = readReleaseInfo(source.id);
  const localTag = localInfo?.releaseTag
    ?? store.getState().databaseSlice.meta?.releaseTag
    ?? null;
  const localDbVersion = store.getState().databaseSlice.meta?.databaseVersion ?? null;

  // Up-to-date if either:
  //   * the release tags match, OR
  //   * the local databaseVersion is already >= the remote one (covers the
  //     case where release.json failed to write but database.json did).
  if (localTag && localTag === remote.releaseTag) {
    return;
  }
  if (
    localDbVersion !== null &&
    typeof remote.databaseVersion === 'number' &&
    localDbVersion >= remote.databaseVersion
  ) {
    return;
  }

  const win = getActiveWindow();
  if (!win) return;

  const detail = (() => {
    const lines: string[] = [];
    if (localTag) lines.push(`Local: ${localTag}`);
    else if (localDbVersion !== null)
      lines.push(`Local: databaseVersion v${localDbVersion} (no release tag)`);
    else lines.push('Local: bundled (no release downloaded yet)');
    lines.push(
      `Latest: ${remote.releaseTag} (published ${remote.releasePublishedAt.slice(0, 10)})`,
    );
    lines.push(`databaseVersion: v${remote.databaseVersion}`);
    return lines.join('\n');
  })();

  const result = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'Database update available',
    message: `A new release (${remote.releaseTag}) is available for ${source.displayName}.`,
    detail,
    buttons: ['Download now', 'Later', "Don't ask again"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 2) {
    saveConfig({ checkDatabaseOnStartup: false });
    store.dispatch(setCheckDatabaseOnStartupAction(false));
    return;
  }
  if (result.response !== 0) return;

  try {
    await downloadSource(source);
    const payload = loadDatabase(source.id);
    store.dispatch(setDatabase(payload));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Auto download failed:', err);
    if (win && !win.isDestroyed()) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: 'Database download failed',
        message: `Could not download release ${remote.releaseTag}.`,
        detail: message,
        buttons: ['OK'],
      });
    }
  }
}

function fIpcHandlers(): void {
  // Hydrate persisted config into the shared redux store so the renderer sees it.
  const persisted = loadConfig();
  if (persisted.repoPath) store.dispatch(setRepoPath(persisted.repoPath));
  store.dispatch(setVersionCheckOnOpenAction(persisted.versionCheckOnOpen !== false));
  store.dispatch(
    setCheckDatabaseOnStartupAction(persisted.checkDatabaseOnStartup !== false),
  );

  ipcMain.handle('database:load', (_event: IpcMainInvokeEvent) => {
    try {
      const payload = loadDatabase();
      store.dispatch(setDatabase(payload));
      // Fire-and-forget the startup check on the very first successful load.
      void maybeRunStartupDatabaseCheck();
      return { status: 'ok' as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to load database:', message);
      store.dispatch(setDatabaseError(message));
      return { status: 'error' as const, message };
    }
  });

  ipcMain.handle('config:pickRepoPath', async () => {
    const picked = await pickRepoPath();
    return { repoPath: picked };
  });

  ipcMain.handle(
    'config:setVersionCheckOnOpen',
    (_event: IpcMainInvokeEvent, data: { enabled: boolean }) => {
      setVersionCheckOnOpen(data.enabled);
      return { ok: true as const };
    },
  );

  ipcMain.handle(
    'config:setCheckDatabaseOnStartup',
    (_event: IpcMainInvokeEvent, data: { enabled: boolean }) => {
      saveConfig({ checkDatabaseOnStartup: data.enabled });
      store.dispatch(setCheckDatabaseOnStartupAction(data.enabled));
      return { ok: true as const };
    },
  );

  ipcMain.handle(
    'doc:openOrDownload',
    async (
      _event: IpcMainInvokeEvent,
      data: {
        docId: string;
        url: string;
        meta?: { version?: string; lastUpdate?: string; pdfCreated?: string };
      },
    ) => {
      return openOrDownload(data.docId, data.url, data.meta);
    },
  );

  ipcMain.handle(
    'downloads:start',
    async (event: IpcMainInvokeEvent, data: { mode: DownloadMode }) => {
      if (isRunning()) {
        return {
          ok: false as const,
          message: 'A download run is already in progress',
        };
      }
      // Pull the document list from the shared store so the renderer doesn't
      // have to ship hundreds of records over IPC each call.
      const state = store.getState();
      const documents = state.databaseSlice.documents;
      const devices = state.databaseSlice.devices;
      try {
        const summary = await runDownloads(data.mode, documents, devices, (p) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('downloads:progress', p);
          }
        });
        return { ok: true as const, summary };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false as const, message };
      }
    },
  );

  ipcMain.handle('downloads:preview', () => {
    const { repoPath } = loadConfig();
    const state = store.getState();
    const counts = previewDownloadCounts(
      repoPath ?? null,
      state.databaseSlice.documents,
      state.databaseSlice.devices,
    );
    return { counts };
  });

  ipcMain.handle('downloads:cancel', () => {
    requestCancel();
    return { ok: true as const };
  });

  ipcMain.handle('databaseSource:list', () => {
    return { sources: listSources() };
  });

  ipcMain.handle(
    'databaseSource:checkLatest',
    async (_event: IpcMainInvokeEvent, data: { sourceId: string }) => {
      const source = getSource(data.sourceId);
      if (!source) {
        return { ok: false as const, message: `Unknown source ${data.sourceId}` };
      }
      try {
        const remote = await checkLatest(source);
        return { ok: true as const, remote };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false as const, message };
      }
    },
  );

  ipcMain.handle(
    'databaseSource:download',
    async (event: IpcMainInvokeEvent, data: { sourceId: string }) => {
      const source = getSource(data.sourceId);
      if (!source) {
        return { ok: false as const, message: `Unknown source ${data.sourceId}` };
      }
      try {
        const remote = await downloadSource(source, (p) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('databaseSource:progress', {
              sourceId: source.id,
              ...p,
            });
          }
        });
        // Reload the local DB into the shared store so the UI refreshes.
        try {
          const payload = loadDatabase(source.id);
          store.dispatch(setDatabase(payload));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          store.dispatch(setDatabaseError(message));
        }
        return { ok: true as const, remote };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false as const, message };
      }
    },
  );
}

const ipcHandlers = fIpcHandlers;

export default ipcHandlers;
