import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import { ipc } from './docApi';

export function useDatabaseLoader(): void {
  const loaded = useSelector((state: RootState) => state.databaseSlice.loaded);

  useEffect(() => {
    if (loaded) return;
    ipc()?.loadDatabase().catch((err: unknown) => {
      console.error('loadDatabase failed', err);
    });
  }, [loaded]);
}
