import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type {
  DatabasePayload,
  DocumentEntry,
  Family,
  Subfamily,
  Device,
} from '../../shared/types/database';

function resolveDatabaseDir(): string {
  // At runtime main.js lives in build/main/, and the JSONs are copied to
  // build/database/main_database/ by CopyWebpackPlugin.
  const dev = path.resolve(__dirname, '..', 'database', 'main_database');
  if (fs.existsSync(dev)) return dev;
  // Packaged build: extraFiles places the folder next to the executable.
  const packaged = path.resolve(
    path.dirname(app.getPath('exe')),
    'database',
    'main_database',
  );
  return packaged;
}

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as T;
}

export function loadDatabase(): DatabasePayload {
  const dir = resolveDatabaseDir();
  return {
    families: readJson<Family[]>(path.join(dir, 'families.json')),
    subfamilies: readJson<Subfamily[]>(path.join(dir, 'subfamilies.json')),
    documents: readJson<DocumentEntry[]>(path.join(dir, 'documents.json')),
    devices: readJson<Device[]>(path.join(dir, 'devices.json')),
  };
}
