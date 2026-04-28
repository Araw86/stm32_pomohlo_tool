import * as fs from 'fs';
import * as path from 'path';
import type { DocumentEntry } from '../../shared/types/database';

export interface SidecarMeta {
  id: string;
  version: string;
  lastUpdate: string;
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
  const meta: SidecarMeta = {
    id: doc.id,
    version: doc.version,
    lastUpdate: doc.lastUpdate,
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

/** Lightweight metadata variant used by the per-click `openOrDownload` flow,
 * which doesn't have full DocumentEntry context. */
export function writeSidecarLite(
  repoPath: string,
  docId: string,
  meta?: { version?: string; lastUpdate?: string },
): void {
  if (!meta || (!meta.version && !meta.lastUpdate)) return;
  const sidecar: SidecarMeta = {
    id: docId,
    version: meta.version ?? '',
    lastUpdate: meta.lastUpdate ?? '',
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
