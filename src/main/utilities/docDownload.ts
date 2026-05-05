import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow, dialog, shell } from 'electron';
import { download } from 'electron-dl';

import { loadConfig, saveConfig } from './configStore';
import {
  backupExistingPdf,
  pdfPath,
  readSidecar,
  writeSidecarLite,
} from './sidecar';
import { store } from '../store/mainStore';
import {
  setRepoPath,
  setVersionCheckOnOpen as setVersionCheckOnOpenAction,
} from '../../shared/redux/slices/configSlice';

export type OpenResult =
  | { status: 'opened' }
  | { status: 'downloaded-opened' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

function getActiveWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

async function promptForRepoPath(): Promise<string | null> {
  const win = getActiveWindow();
  const result = await (win
    ? dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
    : dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] }));
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

export async function pickRepoPath(): Promise<string | null> {
  const picked = await promptForRepoPath();
  if (picked === null) return null;
  saveConfig({ repoPath: picked });
  store.dispatch(setRepoPath(picked));
  return picked;
}

async function ensureRepoPath(): Promise<string | null> {
  const { repoPath } = loadConfig();
  if (repoPath && fs.existsSync(repoPath)) return repoPath;
  return pickRepoPath();
}

interface DocMeta {
  version?: string;
  lastUpdate?: string;
  pdfCreated?: string;
}

/** Compare the on-disk file (via sidecar.pdfCreated, falling back to mtime)
 * against the DB's pdfCreated. Returns true only when we have enough info
 * to decide and the local copy is older. */
function isLocalOutdated(
  filePath: string,
  repoPath: string,
  docId: string,
  meta: DocMeta,
): boolean {
  if (!meta.pdfCreated) return false;
  const dbCreated = Date.parse(meta.pdfCreated);
  if (Number.isNaN(dbCreated)) return false;

  const sidecar = readSidecar(repoPath, docId);
  if (sidecar?.pdfCreated) {
    const local = Date.parse(sidecar.pdfCreated);
    if (!Number.isNaN(local)) return local < dbCreated;
  }

  try {
    const mtimeMs = fs.statSync(filePath).mtime.getTime();
    return mtimeMs < dbCreated;
  } catch {
    return false;
  }
}

/** Show a native message-box asking what to do about the outdated copy.
 * Returns the user's choice: 0=download new, 1=open current, 2=cancel. */
async function promptOutdated(
  docId: string,
  meta: DocMeta,
  localVersion: string | null,
): Promise<0 | 1 | 2> {
  const win = getActiveWindow();
  const detailLines: string[] = [];
  if (localVersion) detailLines.push(`Local: rev ${localVersion}`);
  if (meta.version) detailLines.push(`Latest: rev ${meta.version}`);
  if (meta.lastUpdate) detailLines.push(`Last update: ${meta.lastUpdate}`);
  if (meta.pdfCreated) detailLines.push(`PDF created: ${meta.pdfCreated.slice(0, 10)}`);
  const detail = detailLines.join('\n');

  const result = await (win
    ? dialog.showMessageBox(win, {
        type: 'question',
        title: 'Newer version available',
        message: `A newer version of ${docId} is available.`,
        detail,
        buttons: ['Download new version', 'Open current copy', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
      })
    : dialog.showMessageBox({
        type: 'question',
        title: 'Newer version available',
        message: `A newer version of ${docId} is available.`,
        detail,
        buttons: ['Download new version', 'Open current copy', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
      }));
  return result.response as 0 | 1 | 2;
}

export async function openOrDownload(
  docId: string,
  url: string,
  meta?: DocMeta,
): Promise<OpenResult> {
  try {
    const repoPath = await ensureRepoPath();
    if (repoPath === null) return { status: 'cancelled' };

    const filePath = pdfPath(repoPath, docId);
    const config = loadConfig();

    if (fs.existsSync(filePath)) {
      // Optional pre-open version check.
      if (config.versionCheckOnOpen !== false && meta) {
        const outdated = isLocalOutdated(filePath, repoPath, docId, meta);
        if (outdated) {
          const sidecar = readSidecar(repoPath, docId);
          const choice = await promptOutdated(docId, meta, sidecar?.version ?? null);
          if (choice === 2) return { status: 'cancelled' };
          if (choice === 0) {
            const win = getActiveWindow();
            if (!win) {
              return { status: 'error', message: 'No active window for download' };
            }
            try {
              backupExistingPdf(filePath, repoPath, docId, sidecar?.version ?? null);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              return { status: 'error', message: `backup failed: ${message}` };
            }
            await download(win, url, {
              directory: repoPath,
              filename: `${docId}.pdf`,
              overwrite: true,
            });
            writeSidecarLite(repoPath, docId, meta);
            const openErr = await shell.openPath(filePath);
            if (openErr) return { status: 'error', message: openErr };
            return { status: 'downloaded-opened' };
          }
          // choice === 1: fall through and open the current copy.
        }
      }

      const err = await shell.openPath(filePath);
      if (err) return { status: 'error', message: err };
      return { status: 'opened' };
    }

    const win = getActiveWindow();
    if (!win) return { status: 'error', message: 'No active window for download' };

    await download(win, url, {
      directory: repoPath,
      filename: `${docId}.pdf`,
      overwrite: true,
    });

    writeSidecarLite(repoPath, docId, meta);

    const openErr = await shell.openPath(filePath);
    if (openErr) return { status: 'error', message: openErr };
    return { status: 'downloaded-opened' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'error', message };
  }
}

export function setVersionCheckOnOpen(enabled: boolean): void {
  saveConfig({ versionCheckOnOpen: enabled });
  store.dispatch(setVersionCheckOnOpenAction(enabled));
}
