import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';

interface IpcHandlers {
  loadDatabase: () => Promise<{ status: 'ok' } | { status: 'error'; message: string }>;
}

export function useDatabaseLoader(): void {
  const loaded = useSelector((state: RootState) => state.databaseSlice.loaded);

  useEffect(() => {
    if (loaded) return;
    const handlers = (window as unknown as { ipc_handlers?: IpcHandlers }).ipc_handlers;
    handlers?.loadDatabase().catch((err: unknown) => {
      console.error('loadDatabase failed', err);
    });
  }, [loaded]);
}
