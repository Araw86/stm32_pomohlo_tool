import { ipcMain } from 'electron';
import { IpcMainInvokeEvent } from 'electron/main';

import { loadDatabase } from './utilities/loadDatabase';
import { loadConfig } from './utilities/configStore';
import { openOrDownload, pickRepoPath } from './utilities/docDownload';
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
    async (_event: IpcMainInvokeEvent, data: { docId: string; url: string }) => {
      return openOrDownload(data.docId, data.url);
    },
  );
}

const ipcHandlers = fIpcHandlers;

export default ipcHandlers;
