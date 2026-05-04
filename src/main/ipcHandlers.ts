import { ipcMain } from 'electron';
import { IpcMainInvokeEvent } from 'electron/main';

import { loadDatabase } from './utilities/loadDatabase';
import { loadConfig } from './utilities/configStore';
import { openOrDownload, pickRepoPath } from './utilities/docDownload';
import {
  DownloadMode,
  isRunning,
  requestCancel,
  runDownloads,
} from './utilities/runDownloads';
import {
  checkLatest,
  downloadSource,
  getSource,
  listSources,
} from './utilities/databaseSources';
import { store } from './store/mainStore';
import { setDatabase, setDatabaseError } from '../shared/redux/slices/databaseSlice';
import { setRepoPath } from '../shared/redux/slices/configSlice';

function fIpcHandlers(): void {
  // Hydrate persisted repo path into the shared redux store so the renderer sees it.
  const { repoPath } = loadConfig();
  if (repoPath) store.dispatch(setRepoPath(repoPath));

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

  ipcMain.handle('config:pickRepoPath', async () => {
    const picked = await pickRepoPath();
    return { repoPath: picked };
  });

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
