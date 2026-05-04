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

export interface DatabaseSourceInfo {
  id: string;
  displayName: string;
  type: 'github-release';
  owner: string;
  repo: string;
}

export interface RemoteDatabaseVersion {
  databaseVersion: number;
  databaseVersionCreatedAt: string;
  scrapedAt: string;
  releaseTag: string;
  releaseName: string;
  releasePublishedAt: string;
  releaseHtmlUrl: string;
  fetchedAt: string;
}

export interface DatabaseSourceProgress {
  sourceId: string;
  file: string;
  current: number;
  total: number;
}

export type DatabaseSourceCheckResult =
  | { ok: true; remote: RemoteDatabaseVersion }
  | { ok: false; message: string };

export type DatabaseSourceDownloadResult =
  | { ok: true; remote: RemoteDatabaseVersion }
  | { ok: false; message: string };

interface IpcHandlers {
  loadDatabase: () => Promise<{ status: 'ok' } | { status: 'error'; message: string }>;
  pickRepoPath: () => Promise<{ repoPath: string | null }>;
  openOrDownload: (
    docId: string,
    url: string,
    meta?: { version?: string; lastUpdate?: string; pdfCreated?: string },
  ) => Promise<OpenResult>;
  startDownloads: (mode: DownloadMode) => Promise<DownloadStartResult>;
  cancelDownloads: () => Promise<{ ok: true }>;
  onDownloadProgress: (cb: (data: DownloadProgress) => void) => () => void;
  listDatabaseSources: () => Promise<{ sources: DatabaseSourceInfo[] }>;
  checkLatestDatabase: (sourceId: string) => Promise<DatabaseSourceCheckResult>;
  downloadDatabaseSource: (sourceId: string) => Promise<DatabaseSourceDownloadResult>;
  onDatabaseSourceProgress: (
    cb: (data: DatabaseSourceProgress) => void,
  ) => () => void;
}

export function ipc(): IpcHandlers | undefined {
  return (window as unknown as { ipc_handlers?: IpcHandlers }).ipc_handlers;
}
