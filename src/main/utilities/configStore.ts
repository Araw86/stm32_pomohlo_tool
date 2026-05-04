import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface PersistedConfig {
  repoPath: string | null;
}

const DEFAULTS: PersistedConfig = { repoPath: null };

function configFilePath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export function loadConfig(): PersistedConfig {
  const file = configFilePath();
  try {
    if (!fs.existsSync(file)) return { ...DEFAULTS };
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch (err) {
    console.error('Failed to read config.json:', err);
    return { ...DEFAULTS };
  }
}

export function saveConfig(update: Partial<PersistedConfig>): PersistedConfig {
  const current = loadConfig();
  const next: PersistedConfig = { ...current, ...update };
  try {
    fs.writeFileSync(configFilePath(), JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write config.json:', err);
  }
  return next;
}
