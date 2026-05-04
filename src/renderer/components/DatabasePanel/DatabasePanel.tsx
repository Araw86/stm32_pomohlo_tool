import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import DownloadIcon from '@mui/icons-material/Download';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import {
  DatabaseSourceInfo,
  DatabaseSourceProgress,
  RemoteDatabaseVersion,
  ipc,
} from '../DocPanel/docApi';

interface SourceUiState {
  remote: RemoteDatabaseVersion | null;
  checking: boolean;
  downloading: boolean;
  progress: DatabaseSourceProgress | null;
  error: string | null;
}

const initialSourceState: SourceUiState = {
  remote: null,
  checking: false,
  downloading: false,
  progress: null,
  error: null,
};

function repoUrl(source: DatabaseSourceInfo): string {
  return `https://github.com/${source.owner}/${source.repo}`;
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return iso;
  }
}

function DatabaseSourceCard({
  source,
  isActive,
}: {
  source: DatabaseSourceInfo;
  isActive: boolean;
}): JSX.Element {
  const meta = useSelector((s: RootState) => s.databaseSlice.meta);
  const loaded = useSelector((s: RootState) => s.databaseSlice.loaded);

  const [state, setState] = useState<SourceUiState>(initialSourceState);

  useEffect(() => {
    const unsub = ipc()?.onDatabaseSourceProgress((p) => {
      if (p.sourceId !== source.id) return;
      setState((prev) => ({ ...prev, progress: p }));
    });
    return () => unsub?.();
  }, [source.id]);

  const handleCheck = async () => {
    setState((prev) => ({ ...prev, checking: true, error: null }));
    try {
      const result = await ipc()?.checkLatestDatabase(source.id);
      if (!result) {
        setState((prev) => ({ ...prev, error: 'IPC unavailable', checking: false }));
        return;
      }
      if (result.ok === true) {
        setState((prev) => ({ ...prev, remote: result.remote, checking: false }));
      } else {
        setState((prev) => ({ ...prev, error: result.message, checking: false }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
        checking: false,
      }));
    }
  };

  const handleDownload = async () => {
    setState((prev) => ({
      ...prev,
      downloading: true,
      error: null,
      progress: { sourceId: source.id, file: '', current: 0, total: 0 },
    }));
    try {
      const result = await ipc()?.downloadDatabaseSource(source.id);
      if (!result) {
        setState((prev) => ({ ...prev, error: 'IPC unavailable', downloading: false }));
        return;
      }
      if (result.ok === true) {
        setState((prev) => ({
          ...prev,
          remote: result.remote,
          downloading: false,
          progress: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          error: result.message,
          downloading: false,
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
        downloading: false,
      }));
    }
  };

  const localVersion = isActive && loaded ? meta?.databaseVersion ?? null : null;
  const localCreated = isActive && loaded ? meta?.databaseVersionCreatedAt : null;
  const localReleaseTag = isActive && loaded ? meta?.releaseTag ?? null : null;
  const localReleasePublished = isActive && loaded ? meta?.releasePublishedAt : null;
  const remoteVersion = state.remote?.databaseVersion ?? null;
  const remoteCreated = state.remote?.databaseVersionCreatedAt;
  const remoteReleaseTag = state.remote?.releaseTag ?? null;

  // Prefer release tag comparison (the user-facing identifier on GitHub).
  // Fall back to databaseVersion when one side has no tag (e.g. bundled seed).
  const updateAvailable =
    remoteReleaseTag !== null &&
    (localReleaseTag === null || localReleaseTag !== remoteReleaseTag) &&
    (localVersion === null ||
      remoteVersion === null ||
      remoteVersion >= localVersion);
  const upToDate =
    remoteReleaseTag !== null &&
    localReleaseTag !== null &&
    remoteReleaseTag === localReleaseTag;

  const progressPct =
    state.progress && state.progress.total > 0
      ? Math.round((state.progress.current / state.progress.total) * 100)
      : 0;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          {source.displayName}
        </Typography>
        {isActive && <Chip label="active" size="small" color="primary" />}
        {updateAvailable && (
          <Chip label="update available" size="small" color="warning" />
        )}
        {upToDate && <Chip label="up-to-date" size="small" color="success" />}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Source:{' '}
        <Link href={`${repoUrl(source)}/releases`} target="_blank" rel="noreferrer">
          {repoUrl(source)}/releases
        </Link>
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box flex={1}>
          <Typography variant="caption" color="text.secondary">
            Local
          </Typography>
          {isActive && loaded ? (
            <Box>
              <Typography variant="body2">
                {localReleaseTag
                  ? `Release ${localReleaseTag}`
                  : 'bundled (no release yet)'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {localVersion !== null
                  ? `databaseVersion v${localVersion}`
                  : ''}
                {localReleasePublished
                  ? ` · published ${formatDate(localReleasePublished)}`
                  : localCreated
                    ? ` · scraped ${formatDate(localCreated)}`
                    : ''}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2">
              {isActive ? 'not loaded yet' : 'inactive — not loaded'}
            </Typography>
          )}
        </Box>
        <Box flex={1}>
          <Typography variant="caption" color="text.secondary">
            Remote (latest release)
          </Typography>
          {state.remote ? (
            <Box>
              <Typography variant="body2">
                Release {state.remote.releaseTag}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                databaseVersion v{state.remote.databaseVersion} · published{' '}
                {formatDate(state.remote.releasePublishedAt)}
              </Typography>
              <Box>
                <Link
                  href={state.remote.releaseHtmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  variant="caption"
                >
                  View release on GitHub
                </Link>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2">not checked yet</Typography>
          )}
        </Box>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          startIcon={
            state.checking ? <CircularProgress size={16} /> : <CloudSyncIcon />
          }
          onClick={handleCheck}
          disabled={state.checking || state.downloading}
        >
          Check for updates
        </Button>
        <Button
          variant="contained"
          startIcon={
            state.downloading ? <CircularProgress size={16} /> : <DownloadIcon />
          }
          onClick={handleDownload}
          disabled={state.downloading || state.checking}
        >
          {updateAvailable ? 'Download latest' : 'Download'}
        </Button>
      </Stack>

      {state.downloading && (
        <Box mt={2}>
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{ height: 6, borderRadius: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            {state.progress?.file
              ? `${state.progress.file} (${state.progress.current}/${state.progress.total})`
              : 'starting…'}
          </Typography>
        </Box>
      )}

      {state.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {state.error}
        </Alert>
      )}
    </Paper>
  );
}

function DatabasePanel(): JSX.Element {
  const meta = useSelector((s: RootState) => s.databaseSlice.meta);
  const [sources, setSources] = useState<DatabaseSourceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ipc()?.listDatabaseSources();
        if (!cancelled && res) setSources(res.sources);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box m={2} display="flex" justifyContent="center">
      <Paper sx={{ p: 3, maxWidth: 880, width: '100%' }}>
        <Typography variant="h6" gutterBottom>
          Database
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Manage device-and-document data sources. The active source is the one
          loaded into the app right now. Custom sources can be added in a
          future update.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={2}>
          {sources.map((s) => (
            <DatabaseSourceCard
              key={s.id}
              source={s}
              isActive={meta?.sourceId === s.id || (!meta && s.id === 'main')}
            />
          ))}
          {sources.length === 0 && !error && (
            <Typography color="text.secondary">Loading sources…</Typography>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}

export default DatabasePanel;
