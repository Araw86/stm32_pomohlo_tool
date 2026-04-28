import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { download } from 'electron-dl';

import { loadConfig } from './configStore';
import {
  pdfPath,
  readSidecar,
  sidecarPath,
  writeSidecar,
} from './sidecar';
import type { DocumentEntry } from '../../shared/types/database';

export type DownloadMode = 'all' | 'missing' | 'new';

export interface DownloadProgress {
  current: number;        // 1-indexed (after the action) — total may equal current at the end
  total: number;
  docId: string;
  status: 'starting' | 'downloaded' | 'skipped' | 'backed-up' | 'failed' | 'complete';
  reason?: string;        // e.g. 'already-on-disk', 'up-to-date'
  message?: string;       // error message when status='failed'
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

let cancelRequested = false;
let runInFlight = false;

export function requestCancel(): void {
  cancelRequested = true;
}

export function isRunning(): boolean {
  return runInFlight;
}

function getActiveWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function backupExisting(
  repoPath: string,
  docId: string,
  oldVersion: string | null,
): { backupPdf: string; movedSidecar: boolean } | null {
  const src = pdfPath(repoPath, docId);
  if (!fs.existsSync(src)) return null;

  const backupDir = path.join(repoPath, 'backup');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const verPart = oldVersion ? `v${oldVersion}` : 'v_unknown';
  const safeVer = verPart.replace(/[^A-Za-z0-9_.-]/g, '_');

  // If a backup of this version already exists, suffix with timestamp.
  let target = path.join(backupDir, `${docId}_${safeVer}.pdf`);
  if (fs.existsSync(target)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    target = path.join(backupDir, `${docId}_${safeVer}_${stamp}.pdf`);
  }
  fs.renameSync(src, target);

  let movedSidecar = false;
  const oldSidecar = sidecarPath(repoPath, docId);
  if (fs.existsSync(oldSidecar)) {
    const sidecarTarget = target.replace(/\.pdf$/, '.json');
    fs.renameSync(oldSidecar, sidecarTarget);
    movedSidecar = true;
  }
  return { backupPdf: target, movedSidecar };
}

export async function runDownloads(
  mode: DownloadMode,
  documents: DocumentEntry[],
  onProgress: (p: DownloadProgress) => void,
): Promise<DownloadSummary> {
  if (runInFlight) {
    throw new Error('A download run is already in progress');
  }
  runInFlight = true;
  cancelRequested = false;

  const summary: DownloadSummary = {
    mode,
    total: documents.length,
    downloaded: 0,
    skipped: 0,
    backedUp: 0,
    failed: 0,
    cancelled: false,
    errors: [],
  };

  try {
    const { repoPath } = loadConfig();
    if (!repoPath || !fs.existsSync(repoPath)) {
      throw new Error('No local repository configured. Set it on the Settings tab first.');
    }

    const win = getActiveWindow();
    if (!win) throw new Error('No active window for download');

    for (let i = 0; i < documents.length; i++) {
      if (cancelRequested) {
        summary.cancelled = true;
        break;
      }

      const doc = documents[i];
      const stepBase = { current: i + 1, total: documents.length, docId: doc.id };
      onProgress({ ...stepBase, status: 'starting' });

      const filePath = pdfPath(repoPath, doc.id);
      const exists = fs.existsSync(filePath);

      // Mode-specific decision
      if (mode === 'missing' && exists) {
        summary.skipped++;
        onProgress({ ...stepBase, status: 'skipped', reason: 'already-on-disk' });
        continue;
      }

      if (mode === 'new') {
        const sidecar = readSidecar(repoPath, doc.id);
        if (sidecar && sidecar.version === doc.version) {
          summary.skipped++;
          onProgress({ ...stepBase, status: 'skipped', reason: 'up-to-date' });
          continue;
        }
        if (exists) {
          try {
            backupExisting(repoPath, doc.id, sidecar?.version ?? null);
            summary.backedUp++;
            onProgress({ ...stepBase, status: 'backed-up' });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            summary.failed++;
            summary.errors.push({ docId: doc.id, message: `backup: ${message}` });
            onProgress({ ...stepBase, status: 'failed', message: `backup: ${message}` });
            continue;
          }
        }
      }

      // mode === 'all' overwrites; existing file is replaced (no backup).
      try {
        await download(win, doc.url, {
          directory: repoPath,
          filename: `${doc.id}.pdf`,
          overwrite: true,
          showBadge: false,
        });
        writeSidecar(repoPath, doc);
        summary.downloaded++;
        onProgress({ ...stepBase, status: 'downloaded' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.failed++;
        summary.errors.push({ docId: doc.id, message });
        onProgress({ ...stepBase, status: 'failed', message });
      }
    }
  } finally {
    runInFlight = false;
    cancelRequested = false;
  }

  onProgress({
    current: summary.downloaded + summary.skipped + summary.failed,
    total: summary.total,
    docId: '',
    status: 'complete',
  });
  return summary;
}
