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

export interface DownloadCounts {
  total: number;
  onDisk: number;
  missing: number;
  outdated: number;
  toUpdate: number;
  noRepo: boolean;
  /** Subset of `total` that are PDF board schematics. Surfaces in the UI
   *  so the user knows board files are part of the bulk download. */
  schematicsTotal: number;
}

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

// Re-export so callers don't have to dig into the shared types.
export type {
  CustomFamilyPayload,
  CustomFamilySummary,
} from '../../../shared/types/customFamily';

import type {
  CustomFamilyPayload,
  CustomFamilySummary,
} from '../../../shared/types/customFamily';

export type CustomFamilyResult<T> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

export interface AppInfo {
  version: string;
  name: string;
  electron: string;
  chrome: string;
  node: string;
}

interface IpcHandlers {
  appInfo: () => Promise<AppInfo>;
  openExternal: (
    url: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  loadDatabase: () => Promise<{ status: 'ok' } | { status: 'error'; message: string }>;
  pickRepoPath: () => Promise<{ repoPath: string | null }>;
  setVersionCheckOnOpen: (enabled: boolean) => Promise<{ ok: true }>;
  setCheckDatabaseOnStartup: (enabled: boolean) => Promise<{ ok: true }>;
  openOrDownload: (
    docId: string,
    url: string,
    meta?: { version?: string; lastUpdate?: string; pdfCreated?: string },
  ) => Promise<OpenResult>;
  startDownloads: (mode: DownloadMode) => Promise<DownloadStartResult>;
  previewDownloads: () => Promise<{ counts: DownloadCounts }>;
  cancelDownloads: () => Promise<{ ok: true }>;
  onDownloadProgress: (cb: (data: DownloadProgress) => void) => () => void;
  listDatabaseSources: () => Promise<{ sources: DatabaseSourceInfo[] }>;
  checkLatestDatabase: (sourceId: string) => Promise<DatabaseSourceCheckResult>;
  downloadDatabaseSource: (sourceId: string) => Promise<DatabaseSourceDownloadResult>;
  onDatabaseSourceProgress: (
    cb: (data: DatabaseSourceProgress) => void,
  ) => () => void;

  // ----- File dialogs -----
  pickPdfFile: () => Promise<{ canceled: boolean; paths: string[] }>;
  pickZipFile: () => Promise<{ canceled: boolean; paths: string[] }>;
  saveZipFile: (
    defaultName: string,
  ) => Promise<{ canceled: boolean; path: string }>;

  // ----- Custom families -----
  listCustomFamilies: () => Promise<
    CustomFamilyResult<{ families: CustomFamilySummary[] }>
  >;
  loadCustomFamily: (
    id: string,
  ) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  createCustomFamily: (
    name: string,
  ) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  renameCustomFamily: (
    id: string,
    newName: string,
  ) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  deleteCustomFamily: (
    id: string,
    deletePdfs: boolean,
  ) => Promise<
    CustomFamilyResult<{ removedPdfs: string[]; missingPdfs: string[] }>
  >;
  addCustomSubfamily: (
    familyId: string,
    name: string,
  ) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  renameCustomSubfamily: (
    familyId: string,
    subfamilyId: string,
    name: string,
  ) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  deleteCustomSubfamily: (
    familyId: string,
    subfamilyId: string,
    deletePdfs: boolean,
  ) => Promise<
    CustomFamilyResult<{
      payload: CustomFamilyPayload | null;
      removedPdfs: string[];
    }>
  >;
  addCustomDevice: (
    familyId: string,
    subfamilyId: string,
    name: string,
  ) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  renameCustomDevice: (
    familyId: string,
    deviceId: string,
    name: string,
  ) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  deleteCustomDevice: (
    familyId: string,
    deviceId: string,
    deletePdfs: boolean,
  ) => Promise<
    CustomFamilyResult<{
      payload: CustomFamilyPayload | null;
      removedPdfs: string[];
    }>
  >;
  addCustomDocument: (input: {
    familyId: string;
    subfamilyId: string;
    deviceId: string;
    sourcePath: string;
    docId: string;
    type: string;
    title: string;
    version?: string;
  }) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  linkCustomDocument: (
    familyId: string,
    deviceId: string,
    docId: string,
  ) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  renameCustomDocument: (input: {
    familyId: string;
    docId: string;
    title?: string;
    type?: string;
    version?: string;
  }) => Promise<CustomFamilyResult<{ payload: CustomFamilyPayload }>>;
  deleteCustomDocument: (
    familyId: string,
    docId: string,
    deletePdf: boolean,
  ) => Promise<
    CustomFamilyResult<{
      payload: CustomFamilyPayload | null;
      removedPdf: boolean;
    }>
  >;
  exportCustomFamily: (
    id: string,
    savePath: string,
  ) => Promise<CustomFamilyResult<{ zipPath: string; documentCount: number }>>;
  importCustomFamily: (
    zipPath: string,
    renameTo?: string,
  ) => Promise<
    CustomFamilyResult<{
      familyId: string;
      familyName: string;
      documentCount: number;
      importedPdfs: number;
      skippedExistingPdfs: number;
    }>
  >;
}

export function ipc(): IpcHandlers | undefined {
  return (window as unknown as { ipc_handlers?: IpcHandlers }).ipc_handlers;
}
