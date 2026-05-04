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
import type { Device, DocumentEntry } from '../../shared/types/database';
import { liveVersion } from '../../shared/types/database';

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

interface OnDiskIndex {
  /** All `*.pdf` filenames in the repo, lowercased. */
  pdfNames: Set<string>;
}

function buildOnDiskIndex(repoPath: string): OnDiskIndex {
  const pdfNames = new Set<string>();
  try {
    for (const name of fs.readdirSync(repoPath)) {
      if (name.toLowerCase().endsWith('.pdf')) {
        pdfNames.add(name.toLowerCase());
      }
    }
  } catch (err) {
    console.error('Failed to list repo for on-disk index:', err);
  }
  return { pdfNames };
}

/** Resolves the on-disk PDF for a document, accepting:
 *  1. `${docId}.pdf`  — current convention
 *  2. (Datasheets only) `${deviceId}.pdf` for any device that shares this DS,
 *     to recognize legacy files saved during the per-device naming era. */
function existingPdfFor(
  doc: DocumentEntry,
  devices: Device[],
  index: OnDiskIndex,
): string | null {
  const primary = `${doc.id.toLowerCase()}.pdf`;
  if (index.pdfNames.has(primary)) return primary;

  if (doc.type === 'Datasheet') {
    for (const dev of devices) {
      if (dev.datasheetId !== doc.id) continue;
      const candidate = `${dev.id.toLowerCase()}.pdf`;
      if (index.pdfNames.has(candidate)) return candidate;
    }
  }
  return null;
}

function backupExistingPath(
  src: string,
  repoPath: string,
  docId: string,
  oldVersion: string | null,
): { backupPdf: string; movedSidecar: boolean } | null {
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
  devices: Device[],
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

    const onDisk = buildOnDiskIndex(repoPath);
    console.log(
      `[runDownloads] mode=${mode}; ${onDisk.pdfNames.size} pdf(s) found in ${repoPath}`,
    );

    for (let i = 0; i < documents.length; i++) {
      if (cancelRequested) {
        summary.cancelled = true;
        break;
      }

      const doc = documents[i];
      const stepBase = { current: i + 1, total: documents.length, docId: doc.id };
      onProgress({ ...stepBase, status: 'starting' });

      const filePath = pdfPath(repoPath, doc.id);
      const existingName = existingPdfFor(doc, devices, onDisk);
      const exists = existingName !== null;

      // Mode-specific decision
      if (mode === 'missing' && exists) {
        summary.skipped++;
        const reason =
          existingName === `${doc.id.toLowerCase()}.pdf`
            ? 'already-on-disk'
            : `already-on-disk (legacy: ${existingName})`;
        onProgress({ ...stepBase, status: 'skipped', reason });
        continue;
      }

      if (mode === 'new') {
        const sidecar = readSidecar(repoPath, doc.id);
        const live = liveVersion(doc);
        const dbCreated = live?.pdfCreated ? Date.parse(live.pdfCreated) : NaN;

        if (exists) {
          // The actual on-disk file may be the canonical `${docId}.pdf` or
          // a legacy per-device name; use the resolved one for stat().
          const existingPath = path.join(repoPath, existingName!);

          // Decide if the on-disk copy is up-to-date.
          // 1) Sidecar pdfCreated is the most authoritative — newer-or-equal → up-to-date.
          // 2) Else compare the file's mtime to the DB's pdfCreated. Older mtime → outdated.
          // 3) Fallback: same version label in sidecar → up-to-date.
          let upToDate = false;
          if (sidecar?.pdfCreated && live?.pdfCreated) {
            const localCreated = Date.parse(sidecar.pdfCreated);
            if (!Number.isNaN(localCreated) && !Number.isNaN(dbCreated)) {
              upToDate = localCreated >= dbCreated;
            }
          }
          if (!upToDate && !Number.isNaN(dbCreated)) {
            try {
              const mtimeMs = fs.statSync(existingPath).mtime.getTime();
              upToDate = mtimeMs >= dbCreated;
            } catch {
              // ignore — fall through to version check
            }
          }
          if (!upToDate && sidecar && live && sidecar.version === live.version) {
            upToDate = true;
          }

          if (upToDate) {
            summary.skipped++;
            onProgress({ ...stepBase, status: 'skipped', reason: 'up-to-date' });
            continue;
          }

          try {
            // Move the existing file (whatever its name) into backup.
            backupExistingPath(existingPath, repoPath, doc.id, sidecar?.version ?? null);
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
