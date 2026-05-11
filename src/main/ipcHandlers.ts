import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
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
  boardPdfSchematicsAsDocuments,
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
import {
  AddDocumentInput,
  ImportFamilyOptions,
  addDevice,
  addDocumentToFamily,
  addSubfamily,
  createCustomFamily,
  deleteCustomFamily,
  deleteDevice,
  deleteDocument,
  deleteSubfamily,
  exportCustomFamilyZip,
  importCustomFamilyZip,
  linkExistingDocumentToDevice,
  listCustomFamilies,
  loadCustomFamily,
  renameCustomFamily,
  renameDevice,
  renameDocument,
  renameSubfamily,
} from './utilities/customFamilies';
import { store } from './store/mainStore';
import { setDatabase, setDatabaseError } from '../shared/redux/slices/databaseSlice';
import {
  setRepoPath,
  setVersionCheckOnOpen as setVersionCheckOnOpenAction,
  setCheckDatabaseOnStartup as setCheckDatabaseOnStartupAction,
} from '../shared/redux/slices/configSlice';
import {
  removeCustomFamily as removeCustomFamilyAction,
  setCustomFamilies as setCustomFamiliesAction,
  upsertCustomFamily as upsertCustomFamilyAction,
} from '../shared/redux/slices/customFamiliesSlice';
import type { CustomFamilyPayload } from '../shared/types/customFamily';

function getActiveWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

/** Result returned by `database:startupCheck`. The renderer decides what
 *  modal to show based on the discriminated union.
 *  - `disabled`: the user previously dismissed the prompt with "don't ask".
 *  - `up-to-date`: we have the latest release already.
 *  - `update-available`: there's a newer release than what's local.
 *  - `error`: network or parse failure — surface a soft warning, never block. */
type StartupDatabaseCheckResult =
  | { kind: 'disabled' }
  | {
      kind: 'up-to-date';
      localTag: string | null;
      localDbVersion: number | null;
    }
  | {
      kind: 'update-available';
      remote: {
        databaseVersion: number;
        databaseVersionCreatedAt: string;
        scrapedAt: string;
        releaseTag: string;
        releaseName: string;
        releasePublishedAt: string;
        releaseHtmlUrl: string;
        fetchedAt: string;
      };
      localTag: string | null;
      localDbVersion: number | null;
      sourceId: string;
      sourceDisplayName: string;
    }
  | { kind: 'error'; message: string };

async function computeStartupDatabaseCheck(): Promise<StartupDatabaseCheckResult> {
  const config = loadConfig();
  if (config.checkDatabaseOnStartup === false) return { kind: 'disabled' };

  const source = MAIN_SOURCE;
  let remote;
  try {
    remote = await checkLatest(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('Startup database check failed:', message);
    return { kind: 'error', message };
  }

  // Read release.json directly so we don't depend on redux-load timing.
  const localInfo = readReleaseInfo(source.id);
  const localTag =
    localInfo?.releaseTag ?? store.getState().databaseSlice.meta?.releaseTag ?? null;
  const localDbVersion =
    store.getState().databaseSlice.meta?.databaseVersion ?? null;

  const tagsMatch = !!localTag && localTag === remote.releaseTag;
  const versionGreaterOrEqual =
    localDbVersion !== null &&
    typeof remote.databaseVersion === 'number' &&
    localDbVersion >= remote.databaseVersion;
  if (tagsMatch || versionGreaterOrEqual) {
    return { kind: 'up-to-date', localTag, localDbVersion };
  }

  return {
    kind: 'update-available',
    remote,
    localTag,
    localDbVersion,
    sourceId: source.id,
    sourceDisplayName: source.displayName,
  };
}

/** Read every custom family folder and push them into the renderer-visible
 *  redux state. Called on startup and any time a custom family folder is
 *  created/imported (so the Documents tab can render the new tree without
 *  the user having to flip back to it). */
function refreshCustomFamiliesInStore(): void {
  const summaries = listCustomFamilies();
  const payloads: CustomFamilyPayload[] = [];
  for (const s of summaries) {
    const p = loadCustomFamily(s.id);
    if (p) payloads.push(p);
  }
  store.dispatch(setCustomFamiliesAction(payloads));
}

function fIpcHandlers(): void {
  // Hydrate persisted config into the shared redux store so the renderer sees it.
  const persisted = loadConfig();
  if (persisted.repoPath) store.dispatch(setRepoPath(persisted.repoPath));
  store.dispatch(setVersionCheckOnOpenAction(persisted.versionCheckOnOpen !== false));
  store.dispatch(
    setCheckDatabaseOnStartupAction(persisted.checkDatabaseOnStartup !== false),
  );
  // Hydrate custom families from disk so the Documents tab can show them.
  try {
    refreshCustomFamiliesInStore();
  } catch (err) {
    console.warn('Failed to hydrate custom families:', err);
  }

  // Used by the About tab. Names match what's in package.json.
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    name: app.getName(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }));

  // Opens a URL in the user's default browser. We never let observed page
  // content trigger this — only the About tab's hand-coded link does.
  ipcMain.handle(
    'shell:openExternal',
    async (_event: IpcMainInvokeEvent, data: { url: string }) => {
      try {
        await shell.openExternal(data.url);
        return { ok: true as const };
      } catch (err) {
        return {
          ok: false as const,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle('database:load', (_event: IpcMainInvokeEvent) => {
    try {
      const payload = loadDatabase();
      store.dispatch(setDatabase(payload));
      return { status: 'ok' as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to load database:', message);
      store.dispatch(setDatabaseError(message));
      return { status: 'error' as const, message };
    }
  });

  // Renderer drives the startup-update sequencing. It calls this after the
  // app-update phase finishes so the two dialogs never race.
  ipcMain.handle('database:startupCheck', async () => {
    return computeStartupDatabaseCheck();
  });

  ipcMain.handle('database:disableStartupCheck', () => {
    saveConfig({ checkDatabaseOnStartup: false });
    store.dispatch(setCheckDatabaseOnStartupAction(false));
    return { ok: true as const };
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
      // Append PDF board schematics so they ride the same all/missing/new
      // logic. ZIP schematics are intentionally excluded — those open in
      // the browser only.
      const schematicsAsDocs = boardPdfSchematicsAsDocuments(
        state.databaseSlice.boards,
      );
      const allDocs = [...documents, ...schematicsAsDocs];
      try {
        const summary = await runDownloads(data.mode, allDocs, devices, (p) => {
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
    const schematicsAsDocs = boardPdfSchematicsAsDocuments(
      state.databaseSlice.boards,
    );
    const counts = previewDownloadCounts(
      repoPath ?? null,
      [...state.databaseSlice.documents, ...schematicsAsDocs],
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

  /* ---------------- Custom families ---------------- */

  // Generic file dialogs the panel needs to pick PDFs and zips.
  ipcMain.handle('dialog:pickPdf', async () => {
    const win = getActiveWindow();
    if (!win) return { canceled: true as const, paths: [] };
    const result = await dialog.showOpenDialog(win, {
      title: 'Pick PDF',
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    return {
      canceled: result.canceled,
      paths: result.filePaths,
    };
  });

  ipcMain.handle(
    'dialog:saveZip',
    async (_event, data: { defaultName: string }) => {
      const win = getActiveWindow();
      if (!win) return { canceled: true as const, path: '' };
      const result = await dialog.showSaveDialog(win, {
        title: 'Export custom family',
        defaultPath: data.defaultName,
        filters: [{ name: 'Zip', extensions: ['zip'] }],
      });
      return { canceled: result.canceled, path: result.filePath ?? '' };
    },
  );

  ipcMain.handle('dialog:pickZip', async () => {
    const win = getActiveWindow();
    if (!win) return { canceled: true as const, paths: [] };
    const result = await dialog.showOpenDialog(win, {
      title: 'Import custom family',
      properties: ['openFile'],
      filters: [{ name: 'Zip', extensions: ['zip'] }],
    });
    return { canceled: result.canceled, paths: result.filePaths };
  });

  ipcMain.handle('customFamily:list', () => {
    try {
      return { ok: true as const, families: listCustomFamilies() };
    } catch (err) {
      return wrapErr(err);
    }
  });

  ipcMain.handle(
    'customFamily:load',
    (_event, data: { id: string }) => {
      try {
        const payload = loadCustomFamily(data.id);
        if (!payload) return { ok: false as const, message: `Family '${data.id}' not found.` };
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:create',
    (_event, data: { name: string }) => {
      try {
        const payload = createCustomFamily(data.name);
        store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:rename',
    (_event, data: { id: string; newName: string }) => {
      try {
        const payload = renameCustomFamily(data.id, data.newName);
        store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:delete',
    (_event, data: { id: string; deletePdfs: boolean }) => {
      try {
        const result = deleteCustomFamily(data.id, { deletePdfs: data.deletePdfs });
        store.dispatch(removeCustomFamilyAction(data.id));
        return { ok: true as const, ...result };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:addSubfamily',
    (_event, data: { familyId: string; name: string }) => {
      try {
        const payload = addSubfamily(data.familyId, data.name);
        store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:renameSubfamily',
    (_event, data: { familyId: string; subfamilyId: string; name: string }) => {
      try {
        const payload = renameSubfamily(data.familyId, data.subfamilyId, data.name);
        store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:deleteSubfamily',
    (
      _event,
      data: { familyId: string; subfamilyId: string; deletePdfs: boolean },
    ) => {
      try {
        const removed = deleteSubfamily(data.familyId, data.subfamilyId, {
          deletePdfs: data.deletePdfs,
        });
        // Re-load to return the updated payload.
        const payload = loadCustomFamily(data.familyId);
        if (payload) store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload, removedPdfs: removed.removedPdfs };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:addDevice',
    (_event, data: { familyId: string; subfamilyId: string; name: string }) => {
      try {
        const payload = addDevice(data.familyId, data.subfamilyId, data.name);
        store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:renameDevice',
    (_event, data: { familyId: string; deviceId: string; name: string }) => {
      try {
        const payload = renameDevice(data.familyId, data.deviceId, data.name);
        store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:deleteDevice',
    (
      _event,
      data: { familyId: string; deviceId: string; deletePdfs: boolean },
    ) => {
      try {
        const removed = deleteDevice(data.familyId, data.deviceId, {
          deletePdfs: data.deletePdfs,
        });
        const payload = loadCustomFamily(data.familyId);
        if (payload) store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload, removedPdfs: removed.removedPdfs };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:addDocument',
    (_event, data: AddDocumentInput) => {
      try {
        const payload = addDocumentToFamily(data);
        store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:linkDocument',
    (
      _event,
      data: { familyId: string; deviceId: string; docId: string },
    ) => {
      try {
        const payload = linkExistingDocumentToDevice(
          data.familyId,
          data.deviceId,
          data.docId,
        );
        store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:renameDocument',
    (
      _event,
      data: {
        familyId: string;
        docId: string;
        title?: string;
        type?: string;
        version?: string;
      },
    ) => {
      try {
        const payload = renameDocument(data.familyId, data.docId, {
          title: data.title,
          type: data.type,
          version: data.version,
        });
        store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:deleteDocument',
    (
      _event,
      data: { familyId: string; docId: string; deletePdf: boolean },
    ) => {
      try {
        const result = deleteDocument(data.familyId, data.docId, {
          deletePdf: data.deletePdf,
        });
        const payload = loadCustomFamily(data.familyId);
        if (payload) store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, payload, ...result };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:export',
    (_event, data: { id: string; savePath: string }) => {
      try {
        const result = exportCustomFamilyZip(data.id, data.savePath);
        return { ok: true as const, ...result };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );

  ipcMain.handle(
    'customFamily:import',
    (_event, data: { zipPath: string; renameTo?: string }) => {
      try {
        const result = importCustomFamilyZip(data.zipPath, {
          renameTo: data.renameTo,
        } as ImportFamilyOptions);
        // Reload the imported family into the store so it shows in
        // Documents immediately.
        const payload = loadCustomFamily(result.familyId);
        if (payload) store.dispatch(upsertCustomFamilyAction(payload));
        return { ok: true as const, ...result };
      } catch (err) {
        return wrapErr(err);
      }
    },
  );
}

function wrapErr(err: unknown): { ok: false; message: string } {
  return {
    ok: false,
    message: err instanceof Error ? err.message : String(err),
  };
}

const ipcHandlers = fIpcHandlers;

export default ipcHandlers;
