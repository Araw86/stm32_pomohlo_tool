import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DownloadingIcon from '@mui/icons-material/Downloading';
import UpdateIcon from '@mui/icons-material/Update';
import StopIcon from '@mui/icons-material/Stop';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import {
  DownloadMode,
  DownloadProgress,
  DownloadSummary,
  ipc,
} from '../DocPanel/docApi';

interface ModeDef {
  id: DownloadMode;
  title: string;
  description: string;
  icon: JSX.Element;
}

const MODES: ModeDef[] = [
  {
    id: 'all',
    title: 'Download all documents',
    description:
      'Re-download every document, overwriting the local copy. Use this to refresh the whole library.',
    icon: <DownloadIcon />,
  },
  {
    id: 'missing',
    title: 'Download missing documents',
    description:
      'Download only documents that are not yet in the local repository. Existing files are left alone.',
    icon: <DownloadingIcon />,
  },
  {
    id: 'new',
    title: 'Download new versions',
    description:
      'For each local document, compare its stored version against the database. If a newer version exists, move the old PDF to "backup/<id>_v<old>.pdf" and download the new one.',
    icon: <UpdateIcon />,
  },
];

function statusChip(s: DownloadProgress['status']): string {
  switch (s) {
    case 'starting':
      return 'starting';
    case 'downloaded':
      return 'downloaded';
    case 'skipped':
      return 'skipped';
    case 'backed-up':
      return 'backed up';
    case 'failed':
      return 'failed';
    case 'complete':
      return 'complete';
  }
}

function DownloadPanel(): JSX.Element {
  const repoPath = useSelector((s: RootState) => s.configSlice.repoPath);
  const documents = useSelector((s: RootState) => s.databaseSlice.documents);

  const [running, setRunning] = useState(false);
  const [activeMode, setActiveMode] = useState<DownloadMode | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [summary, setSummary] = useState<DownloadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the most recent unsubscribe so we can clean up.
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = ipc()?.onDownloadProgress((p) => setProgress(p));
    unsubscribeRef.current = unsub ?? null;
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const handleStart = async (mode: DownloadMode) => {
    if (running) return;
    setRunning(true);
    setActiveMode(mode);
    setSummary(null);
    setError(null);
    setProgress({
      current: 0,
      total: documents.length,
      docId: '',
      status: 'starting',
    });
    try {
      const result = await ipc()?.startDownloads(mode);
      if (!result) {
        setError('IPC unavailable');
      } else if (result.ok === true) {
        setSummary(result.summary);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setActiveMode(null);
    }
  };

  const handleCancel = () => {
    void ipc()?.cancelDownloads();
  };

  const total = progress?.total ?? documents.length;
  const current = progress?.current ?? 0;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Box m={2} display="flex" justifyContent="center">
      <Paper sx={{ p: 3, maxWidth: 880, width: '100%' }}>
        <Typography variant="h6" gutterBottom>
          Download
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Bulk-download documents into your local repository.
        </Typography>
        <Typography variant="body2" sx={{ mb: 3 }}>
          Local repository:{' '}
          <Box component="span" sx={{ fontFamily: 'monospace' }}>
            {repoPath ?? '— not configured —'}
          </Box>
        </Typography>

        {!repoPath && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Pick a local repository on the Settings tab before starting a download.
          </Alert>
        )}

        <Stack spacing={2}>
          {MODES.map((m) => (
            <Paper
              key={m.id}
              variant="outlined"
              sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle1">{m.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {m.description}
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={m.icon}
                onClick={() => handleStart(m.id)}
                disabled={running || !repoPath || documents.length === 0}
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                Start
              </Button>
            </Paper>
          ))}
        </Stack>

        {(running || progress) && (
          <Box mt={3}>
            <Stack direction="row" alignItems="center" spacing={2} mb={1}>
              <Typography variant="subtitle2">
                {activeMode
                  ? MODES.find((m) => m.id === activeMode)?.title
                  : 'Last run'}
              </Typography>
              <Box flexGrow={1} />
              {running && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<StopIcon />}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              )}
            </Stack>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{ height: 8, borderRadius: 1 }}
            />
            <Stack
              direction="row"
              justifyContent="space-between"
              mt={0.5}
              spacing={1}
            >
              <Typography variant="caption" color="text.secondary">
                {current} / {total}
                {progress?.docId ? ` · ${progress.docId}` : ''}
                {progress ? ` · ${statusChip(progress.status)}` : ''}
                {progress?.reason ? ` (${progress.reason})` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {pct}%
              </Typography>
            </Stack>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {summary && (
          <Alert
            severity={summary.failed > 0 ? 'warning' : 'success'}
            sx={{ mt: 2 }}
          >
            <Typography variant="subtitle2">
              {summary.cancelled ? 'Cancelled' : 'Done'} — {summary.mode}
            </Typography>
            <Typography variant="body2">
              {summary.downloaded} downloaded · {summary.skipped} skipped ·{' '}
              {summary.backedUp} backed up · {summary.failed} failed · total{' '}
              {summary.total}
            </Typography>
            {summary.errors.length > 0 && (
              <Box
                component="details"
                sx={{ mt: 1, maxHeight: 240, overflow: 'auto' }}
              >
                <summary>Show {summary.errors.length} error(s)</summary>
                <Stack spacing={0.5} mt={1}>
                  {summary.errors.slice(0, 100).map((e, i) => (
                    <Typography
                      key={`${e.docId}-${i}`}
                      variant="caption"
                      sx={{ fontFamily: 'monospace' }}
                    >
                      {e.docId}: {e.message}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default DownloadPanel;
