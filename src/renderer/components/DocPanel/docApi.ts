export interface OpenResult {
  status: 'opened' | 'downloaded-opened' | 'cancelled' | 'error';
  message?: string;
}

interface IpcHandlers {
  loadDatabase: () => Promise<{ status: 'ok' } | { status: 'error'; message: string }>;
  pickRepoPath: () => Promise<{ repoPath: string | null }>;
  openOrDownload: (docId: string, url: string) => Promise<OpenResult>;
}

export function ipc(): IpcHandlers | undefined {
  return (window as unknown as { ipc_handlers?: IpcHandlers }).ipc_handlers;
}
