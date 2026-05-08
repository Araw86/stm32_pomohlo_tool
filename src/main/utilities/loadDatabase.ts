import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type {
  Board,
  DatabaseMeta,
  DatabasePayload,
  DocumentEntry,
  Family,
  Subfamily,
  Device,
} from '../../shared/types/database';

interface RawDatabaseFile {
  scrapedAt: string;
  databaseVersion: number;
  databaseVersionCreatedAt: string;
  /** Schema version. Absent on legacy v1 dumps; bumped to 2 when boards
   * were added. The app refuses to load anything newer than what it knows. */
  databaseStructure?: number;
  databaseStructureCreatedAt?: string;
}

/** Highest schema version this build understands. Bump together with any
 *  loader change that consumes a new field. */
export const SUPPORTED_DATABASE_STRUCTURE = 2;

interface RawReleaseInfoFile {
  releaseTag: string;
  releaseName: string;
  releasePublishedAt: string;
  releaseHtmlUrl: string;
  downloadedAt: string;
}

const DEFAULT_SOURCE_ID = 'main';
const DEFAULT_SOURCE_NAME = 'stm32_doc_database (Araw86)';

/** Folder where bundled JSONs ship inside the app. Used as a one-time seed. */
function bundledDir(): string {
  // Dev: build/main/main.js → ../database/main_database/
  const dev = path.resolve(__dirname, '..', 'database', 'main_database');
  if (fs.existsSync(dev)) return dev;
  // Packaged: extraFiles places the folder next to the executable.
  return path.resolve(
    path.dirname(app.getPath('exe')),
    'database',
    'main_database',
  );
}

/** Folder where the live database for a given source lives. Writable.
 *
 * IMPORTANT: do NOT name this folder `databases` — Chromium reserves that
 * name in `userData` for its own WebSQL/IndexedDB storage and wipes any
 * unrecognized files inside it on every app startup. Using `databases`
 * caused our downloaded JSONs to be silently deleted between sessions, so
 * the bundled v45 seed was reapplied on each launch.
 */
export function liveDir(sourceId: string = DEFAULT_SOURCE_ID): string {
  return path.join(app.getPath('userData'), 'local_databases', sourceId);
}

function ensureSeeded(sourceId: string): void {
  const target = liveDir(sourceId);
  const required = ['database.json', 'families.json', 'subfamilies.json', 'devices.json', 'documents.json'];
  const dirExisted = fs.existsSync(target);
  const missing = required.filter((f) => !fs.existsSync(path.join(target, f)));
  if (missing.length === 0) return;

  const src = bundledDir();
  if (!fs.existsSync(src)) {
    console.warn(`[ensureSeeded] bundled dir ${src} not found, skipping seed.`);
    return;
  }

  // If the live dir already existed but is missing files, that's a sign of
  // partial corruption (e.g. a crash mid-write) — warn loudly so the cause
  // of any version-rollback isn't invisible. On first run the dir simply
  // doesn't exist yet, which is normal and silent.
  if (dirExisted) {
    console.warn(
      `[ensureSeeded] live dir ${target} is missing files [${missing.join(
        ', ',
      )}]; filling from bundled seed. If you previously downloaded a newer release, those files may have been lost.`,
    );
  }

  fs.mkdirSync(target, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(target, name);
    if (!fs.existsSync(to)) {
      try {
        fs.copyFileSync(from, to);
      } catch (err) {
        console.error(`Seed copy failed for ${name}:`, err);
      }
    }
  }
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function readReleaseFile(dir: string): RawReleaseInfoFile | null {
  const file = path.join(dir, 'release.json');
  if (!fs.existsSync(file)) return null;
  try {
    return readJson<RawReleaseInfoFile>(file);
  } catch (err) {
    console.error('Failed to read release.json:', err);
    return null;
  }
}

export function loadDatabase(sourceId: string = DEFAULT_SOURCE_ID): DatabasePayload {
  ensureSeeded(sourceId);
  const dir = liveDir(sourceId);

  const dbFile = readJson<RawDatabaseFile>(path.join(dir, 'database.json'));

  // Refuse to load a future schema version — fields and relations may have
  // changed in ways this build can't interpret. Older dumps (no field, or
  // a value <= SUPPORTED) are fine: we just won't surface fields the older
  // dump didn't have.
  if (
    typeof dbFile.databaseStructure === 'number' &&
    dbFile.databaseStructure > SUPPORTED_DATABASE_STRUCTURE
  ) {
    throw new Error(
      `This database uses structure v${dbFile.databaseStructure}, but this build of stm32_pomohlo_tool only understands up to v${SUPPORTED_DATABASE_STRUCTURE}. Please update the application before downloading this release.`,
    );
  }

  const release = readReleaseFile(dir);
  const meta: DatabaseMeta = {
    databaseVersion: dbFile.databaseVersion,
    databaseVersionCreatedAt: dbFile.databaseVersionCreatedAt,
    databaseStructure: dbFile.databaseStructure,
    databaseStructureCreatedAt: dbFile.databaseStructureCreatedAt,
    scrapedAt: dbFile.scrapedAt,
    sourceId,
    sourceName: sourceId === DEFAULT_SOURCE_ID ? DEFAULT_SOURCE_NAME : sourceId,
    releaseTag: release?.releaseTag,
    releaseName: release?.releaseName,
    releasePublishedAt: release?.releasePublishedAt,
    downloadedAt: release?.downloadedAt,
  };

  // boards.json was added in databaseStructure 2. Tolerate its absence:
  // older dumps simply have no boards data, and the UI hides the button.
  let boards: Board[] = [];
  const boardsFile = path.join(dir, 'boards.json');
  if (fs.existsSync(boardsFile)) {
    try {
      boards = readJson<Board[]>(boardsFile);
    } catch (err) {
      console.warn('Failed to parse boards.json (continuing without):', err);
    }
  }

  return {
    families: readJson<Family[]>(path.join(dir, 'families.json')),
    subfamilies: readJson<Subfamily[]>(path.join(dir, 'subfamilies.json')),
    documents: readJson<DocumentEntry[]>(path.join(dir, 'documents.json')),
    devices: readJson<Device[]>(path.join(dir, 'devices.json')),
    boards,
    meta,
  };
}
