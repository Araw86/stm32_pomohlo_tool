import { ipcMain } from 'electron';
import { IpcMainInvokeEvent } from 'electron/main';

import { loadDatabase } from './utilities/loadDatabase';
import { store } from './store/mainStore';
import { setDatabase, setDatabaseError } from '../shared/redux/slices/databaseSlice';

function fIpcHandlers(): void {
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
}

const ipcHandlers = fIpcHandlers;

export default ipcHandlers;
