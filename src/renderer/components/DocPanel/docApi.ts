export interface OpenResult {
  status: 'opened' | 'downloaded-opened' | 'cancelled' | 'error';
  message?: string;
}

export type DownloadMode = 'all' | 'missing' | 'new';

export interface DownloadProgress {
  current: number;
  total: number;
  docId: string;
  status: 'starting' | 'downloaded' | 'skipped' | 'backed-up' | 'failed' | 'complete';
  reason?: string;
  message?: string;
}

export interface DownloadSummary {
  mode: DownloadMode;
  total: number;
  downloaded: number;
  skipped: number;
  backedUp: number;
  failed: number;
  cancelled: boolean;
  errors: { docId: string; message: string }[];
}

export type DownloadStartResult =
  | { ok: true; summary: DownloadSummary }
  | { ok: false; message: string };

interface IpcHandlers {
  loadDatabase: () => Promise<{ status: 'ok' } | { status: 'error'; message: string }>;
  pickRepoPath: () => Promise<{ repoPath: string | null }>;
  openOrDownload: (
    docId: string,
    url: string,
    meta?: { version?: string; lastUpdate?: string },
  ) => Promise<OpenResult>;
  startDownloads: (mode: DownloadMode) => Promise<DownloadStartResult>;
  cancelDownloads: () => Promise<{ ok: true }>;
  onDownloadProgress: (cb: (data: DownloadProgress) => void) => () => void;
}

export function ipc(): IpcHandlers | undefined {
  return (window as unknown as { ipc_handlers?: IpcHandlers }).ipc_handlers;
}
