import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow, dialog, shell } from 'electron';
import { download } from 'electron-dl';

import { loadConfig, saveConfig } from './configStore';
import { writeSidecarLite } from './sidecar';
import { store } from '../store/mainStore';
import { setRepoPath } from '../../shared/redux/slices/configSlice';

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

export async function openOrDownload(
  docId: string,
  url: string,
  meta?: { version?: string; lastUpdate?: string; pdfCreated?: string },
): Promise<OpenResult> {
  try {
    const repoPath = await ensureRepoPath();
    if (repoPath === null) return { status: 'cancelled' };

    const filePath = path.join(repoPath, `${docId}.pdf`);

    if (fs.existsSync(filePath)) {
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
