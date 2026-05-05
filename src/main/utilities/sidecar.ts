import * as fs from 'fs';
import * as path from 'path';
import type { DocumentEntry } from '../../shared/types/database';
import { liveVersion } from '../../shared/types/database';

export interface SidecarMeta {
  id: string;
  /** Live version label at the time of download (e.g. "13.0"). */
  version: string;
  /** ST "Last update" date for the downloaded version. */
  lastUpdate: string;
  /** PDF /CreationDate metadata for the downloaded version. */
  pdfCreated: string;
  /** When this app wrote the PDF to disk. */
  downloadedAt: string;
}

export function sidecarPath(repoPath: string, docId: string, dir: string = repoPath): string {
  return path.join(dir, `${docId}.json`);
}

export function pdfPath(repoPath: string, docId: string, dir: string = repoPath): string {
  return path.join(dir, `${docId}.pdf`);
}

export function readSidecar(repoPath: string, docId: string): SidecarMeta | null {
  const file = sidecarPath(repoPath, docId);
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as SidecarMeta;
  } catch {
    return null;
  }
}

export function writeSidecar(repoPath: string, doc: DocumentEntry): void {
  const live = liveVersion(doc);
  if (!live) return;
  const meta: SidecarMeta = {
    id: doc.id,
    version: live.version,
    lastUpdate: live.lastUpdate ?? '',
    pdfCreated: live.pdfCreated ?? '',
    downloadedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(
      sidecarPath(repoPath, doc.id),
      JSON.stringify(meta, null, 2),
      'utf8',
    );
  } catch (err) {
    console.error(`Failed to write sidecar for ${doc.id}:`, err);
  }
}

/** Move an existing PDF (and its sidecar, when present) into the repo's
 * `backup/` folder. The destination is named `${docId}_v${oldVersion}.pdf`,
 * or `${docId}_v_unknown.pdf` if no version is known. Returns the backup
 * path, or null when there's nothing to back up. */
export function backupExistingPdf(
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

/** Lightweight metadata variant used by the per-click `openOrDownload` flow,
 * which doesn't have full DocumentEntry context. */
export function writeSidecarLite(
  repoPath: string,
  docId: string,
  meta?: { version?: string; lastUpdate?: string; pdfCreated?: string },
): void {
  if (!meta || (!meta.version && !meta.lastUpdate && !meta.pdfCreated)) return;
  const sidecar: SidecarMeta = {
    id: docId,
    version: meta.version ?? '',
    lastUpdate: meta.lastUpdate ?? '',
    pdfCreated: meta.pdfCreated ?? '',
    downloadedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(
      sidecarPath(repoPath, docId),
      JSON.stringify(sidecar, null, 2),
      'utf8',
    );
  } catch (err) {
    console.error(`Failed to write sidecar for ${docId}:`, err);
  }
}
