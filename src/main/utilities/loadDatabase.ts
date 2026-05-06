import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type {
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
}

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

/** Folder where the live database for a given source lives. Writable. */
export function liveDir(sourceId: string = DEFAULT_SOURCE_ID): string {
  return path.join(app.getPath('userData'), 'databases', sourceId);
}

function ensureSeeded(sourceId: string): void {
  const target = liveDir(sourceId);
  const required = ['database.json', 'families.json', 'subfamilies.json', 'devices.json', 'documents.json'];
  const missing = required.filter((f) => !fs.existsSync(path.join(target, f)));
  if (missing.length === 0) return;

  const src = bundledDir();
  if (!fs.existsSync(src)) return;

  // Loud warning — if this fires on a system that already downloaded a
  // release, it means files went missing between sessions (e.g. a crash
  // mid-rename) and we're about to mask the downloaded data with the
  // bundled seed. The user was likely confused about why their old
  // databaseVersion came back; surfacing it here makes the cause obvious.
  if (fs.existsSync(target)) {
    console.warn(
      `[loadDatabase] live dir ${target} is missing required files [${missing.join(
        ', ',
      )}], filling from bundled seed at ${src}. If you previously downloaded a newer release, those files may have been lost.`,
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
  const release = readReleaseFile(dir);
  console.info(
    `[loadDatabase] source=${sourceId} dir=${dir} databaseVersion=v${dbFile.databaseVersion} releaseTag=${
      release?.releaseTag ?? '(none)'
    }`,
  );
  const meta: DatabaseMeta = {
    databaseVersion: dbFile.databaseVersion,
    databaseVersionCreatedAt: dbFile.databaseVersionCreatedAt,
    scrapedAt: dbFile.scrapedAt,
    sourceId,
    sourceName: sourceId === DEFAULT_SOURCE_ID ? DEFAULT_SOURCE_NAME : sourceId,
    releaseTag: release?.releaseTag,
    releaseName: release?.releaseName,
    releasePublishedAt: release?.releasePublishedAt,
    downloadedAt: release?.downloadedAt,
  };

  return {
    families: readJson<Family[]>(path.join(dir, 'families.json')),
    subfamilies: readJson<Subfamily[]>(path.join(dir, 'subfamilies.json')),
    documents: readJson<DocumentEntry[]>(path.join(dir, 'documents.json')),
    devices: readJson<Device[]>(path.join(dir, 'devices.json')),
    meta,
  };
}
