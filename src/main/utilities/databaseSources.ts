import * as fs from 'fs';
import * as path from 'path';
import { liveDir } from './loadDatabase';

export interface GithubSource {
  id: string;
  displayName: string;
  type: 'github-release';
  owner: string;
  repo: string;
}

export type DatabaseSource = GithubSource;

export interface RemoteVersion {
  databaseVersion: number;
  databaseVersionCreatedAt: string;
  scrapedAt: string;
  releaseTag: string;
  releaseName: string;
  releasePublishedAt: string;
  releaseHtmlUrl: string;
  fetchedAt: string;
}

export interface ReleaseInfoFile {
  releaseTag: string;
  releaseName: string;
  releasePublishedAt: string;
  releaseHtmlUrl: string;
  downloadedAt: string;
}

const DB_FILES = [
  'database.json',
  'families.json',
  'subfamilies.json',
  'devices.json',
  'documents.json',
  'catalog.json',
] as const;

const REQUIRED_FILES: readonly string[] = [
  'database.json',
  'families.json',
  'subfamilies.json',
  'devices.json',
  'documents.json',
];

const RELEASE_INFO_FILE = 'release.json';

/** The single built-in source. Custom sources can be added later via config. */
export const MAIN_SOURCE: DatabaseSource = {
  id: 'main',
  displayName: 'stm32_doc_database (Araw86)',
  type: 'github-release',
  owner: 'Araw86',
  repo: 'stm32_doc_database',
};

export function listSources(): DatabaseSource[] {
  return [MAIN_SOURCE];
}

export function getSource(id: string): DatabaseSource | undefined {
  return listSources().find((s) => s.id === id);
}

interface GithubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GithubRelease {
  tag_name: string;
  name: string | null;
  published_at: string;
  html_url: string;
  assets: GithubAsset[];
}

const GITHUB_HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'stm32_pomohlo_tool',
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: GITHUB_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  }
  return (await res.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': GITHUB_HEADERS['User-Agent'] },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  }
  return res.text();
}

async function fetchLatestRelease(source: GithubSource): Promise<GithubRelease> {
  const url = `https://api.github.com/repos/${source.owner}/${source.repo}/releases/latest`;
  try {
    return await fetchJson<GithubRelease>(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('HTTP 404')) {
      throw new Error(
        `${source.displayName} has no releases yet. Publish a release on GitHub first.`,
      );
    }
    throw err;
  }
}

function findAsset(release: GithubRelease, name: string): GithubAsset | undefined {
  return release.assets.find((a) => a.name === name);
}

export async function checkLatest(source: DatabaseSource): Promise<RemoteVersion> {
  const release = await fetchLatestRelease(source);
  const dbAsset = findAsset(release, 'database.json');
  if (!dbAsset) {
    throw new Error(
      `Release ${release.tag_name} is missing the database.json asset.`,
    );
  }
  const text = await fetchText(dbAsset.browser_download_url);
  const parsed = JSON.parse(text) as {
    databaseVersion: number;
    databaseVersionCreatedAt: string;
    scrapedAt: string;
  };
  if (typeof parsed.databaseVersion !== 'number') {
    throw new Error('Release database.json is missing databaseVersion');
  }
  return {
    databaseVersion: parsed.databaseVersion,
    databaseVersionCreatedAt: parsed.databaseVersionCreatedAt,
    scrapedAt: parsed.scrapedAt,
    releaseTag: release.tag_name,
    releaseName: release.name ?? release.tag_name,
    releasePublishedAt: release.published_at,
    releaseHtmlUrl: release.html_url,
    fetchedAt: new Date().toISOString(),
  };
}

export interface DownloadProgress {
  file: string;
  current: number;
  total: number;
}

export async function downloadSource(
  source: DatabaseSource,
  onProgress?: (p: DownloadProgress) => void,
): Promise<RemoteVersion> {
  const release = await fetchLatestRelease(source);

  // Resolve which files we'll fetch. Required ones must be present as assets.
  const filesToFetch: { file: string; url: string }[] = [];
  for (const file of DB_FILES) {
    const asset = findAsset(release, file);
    if (!asset) {
      if (REQUIRED_FILES.includes(file)) {
        throw new Error(
          `Release ${release.tag_name} is missing required asset ${file}.`,
        );
      }
      continue;
    }
    filesToFetch.push({ file, url: asset.browser_download_url });
  }

  // Stage 1 — fetch every file into memory and validate JSON before touching disk.
  const buffered: { file: string; body: string }[] = [];
  for (let i = 0; i < filesToFetch.length; i++) {
    const { file, url } = filesToFetch[i];
    onProgress?.({ file, current: i, total: filesToFetch.length });
    const text = await fetchText(url);
    try {
      JSON.parse(text);
    } catch (err) {
      throw new Error(`Release ${file} is not valid JSON: ${(err as Error).message}`);
    }
    buffered.push({ file, body: text });
  }

  // Stage 2 — write atomically: every file goes to .tmp first, then rename.
  const target = liveDir(source.id);
  fs.mkdirSync(target, { recursive: true });

  const tmpFiles: string[] = [];
  try {
    for (const { file, body } of buffered) {
      const tmp = path.join(target, `${file}.tmp`);
      fs.writeFileSync(tmp, body, 'utf8');
      tmpFiles.push(tmp);
    }
    for (const tmp of tmpFiles) {
      const final = tmp.replace(/\.tmp$/, '');
      if (process.platform === 'win32' && fs.existsSync(final)) {
        fs.rmSync(final, { force: true });
      }
      fs.renameSync(tmp, final);
    }
  } catch (err) {
    for (const tmp of tmpFiles) {
      try {
        if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
      } catch {
        /* ignore */
      }
    }
    throw err;
  }

  // Persist release info next to the live db so loadDatabase can surface it.
  const releaseInfo: ReleaseInfoFile = {
    releaseTag: release.tag_name,
    releaseName: release.name ?? release.tag_name,
    releasePublishedAt: release.published_at,
    releaseHtmlUrl: release.html_url,
    downloadedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(
      path.join(target, RELEASE_INFO_FILE),
      JSON.stringify(releaseInfo, null, 2),
      'utf8',
    );
  } catch (err) {
    console.error('Failed to write release.json:', err);
  }

  const dbJson = JSON.parse(
    fs.readFileSync(path.join(target, 'database.json'), 'utf8'),
  ) as { databaseVersion: number; databaseVersionCreatedAt: string; scrapedAt: string };
  onProgress?.({
    file: 'done',
    current: filesToFetch.length,
    total: filesToFetch.length,
  });
  return {
    databaseVersion: dbJson.databaseVersion,
    databaseVersionCreatedAt: dbJson.databaseVersionCreatedAt,
    scrapedAt: dbJson.scrapedAt,
    releaseTag: release.tag_name,
    releaseName: release.name ?? release.tag_name,
    releasePublishedAt: release.published_at,
    releaseHtmlUrl: release.html_url,
    fetchedAt: new Date().toISOString(),
  };
}

export function readReleaseInfo(sourceId: string): ReleaseInfoFile | null {
  try {
    const file = path.join(liveDir(sourceId), RELEASE_INFO_FILE);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ReleaseInfoFile;
  } catch (err) {
    console.error('Failed to read release.json:', err);
    return null;
  }
}
