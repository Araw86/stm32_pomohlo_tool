import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { ipc, RemoteDatabaseVersion } from '../DocPanel/docApi';

interface Props {
  /** Provided when the result is `update-available`. */
  remote: RemoteDatabaseVersion;
  sourceId: string;
  sourceDisplayName: string;
  localTag: string | null;
  localDbVersion: number | null;
  /** "Later" — close without changing config. */
  onLater: () => void;
  /** "Don't ask again" — persisted in main config, closes dialog. */
  onDontAskAgain: () => void;
  /** Successfully downloaded; the dialog has updated the slice already. */
  onCompleted: () => void;
}

interface DownloadState {
  downloading: boolean;
  file: string;
  current: number;
  total: number;
  error: string | null;
}

/** React-side replacement for the old native database-update message box.
 *  Triggers the same `downloadDatabaseSource` IPC the Database tab uses
 *  and shows the same progress callback inline. */
export function DatabaseUpdateDialog({
  remote,
  sourceId,
  sourceDisplayName,
  localTag,
  localDbVersion,
  onLater,
  onDontAskAgain,
  onCompleted,
}: Props): JSX.Element {
  const [state, setState] = useState<DownloadState>({
    downloading: false,
    file: '',
    current: 0,
    total: 0,
    error: null,
  });

  useEffect(() => {
    const unsub = ipc()?.onDatabaseSourceProgress((p) => {
      if (p.sourceId !== sourceId) return;
      setState((prev) => ({
        ...prev,
        file: p.file,
        current: p.current,
        total: p.total,
      }));
    });
    return () => unsub?.();
  }, [sourceId]);

  const handleDownload = async () => {
    setState({
      downloading: true,
      file: '',
      current: 0,
      total: 0,
      error: null,
    });
    try {
      const result = await ipc()?.downloadDatabaseSource(sourceId);
      if (!result) {
        setState((prev) => ({ ...prev, downloading: false, error: 'IPC unavailable' }));
        return;
      }
      if (result.ok === true) {
        onCompleted();
      } else {
        setState((prev) => ({ ...prev, downloading: false, error: result.message }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  const handleDontAsk = async () => {
    await ipc()?.databaseDisableStartupCheck();
    onDontAskAgain();
  };

  const progressPct =
    state.total > 0 ? Math.round((state.current / state.total) * 100) : 0;

  return (
    <Dialog
      open
      // Block backdrop close while downloading — interrupting half-way
      // through leaves us with partial files we don't fully control.
      onClose={state.downloading ? undefined : onLater}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Database update available</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          A newer release of <strong>{sourceDisplayName}</strong> is available.
        </Typography>

        <Stack spacing={1} sx={{ mb: 2 }}>
          <Row label="Local">
            {localTag
              ? localTag
              : localDbVersion !== null
              ? `databaseVersion v${localDbVersion} (no release tag)`
              : 'bundled (no release downloaded yet)'}
          </Row>
          <Row label="Latest">
            <Stack direction="row" spacing={1} alignItems="baseline">
              <Box component="span" sx={{ fontFamily: 'monospace' }}>
                {remote.releaseTag}
              </Box>
              <Typography variant="caption" color="text.secondary">
                v{remote.databaseVersion} · published{' '}
                {remote.releasePublishedAt.slice(0, 10)}
              </Typography>
            </Stack>
          </Row>
          <Row label="Source">
            <Link
              href={remote.releaseHtmlUrl}
              onClick={(e) => {
                e.preventDefault();
                void ipc()?.openExternal(remote.releaseHtmlUrl);
              }}
              variant="body2"
              sx={{ wordBreak: 'break-all' }}
            >
              {remote.releaseHtmlUrl}
            </Link>
          </Row>
        </Stack>

        {state.downloading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant={state.total > 0 ? 'determinate' : 'indeterminate'}
              value={progressPct}
              sx={{ height: 8, borderRadius: 1 }}
            />
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mt: 0.5 }}
            >
              <Typography variant="caption" color="text.secondary">
                {state.file
                  ? `${state.file} (${state.current}/${state.total})`
                  : 'Starting…'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {state.total > 0 ? `${progressPct}%` : ''}
              </Typography>
            </Stack>
          </Box>
        )}

        {state.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {state.error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          color="inherit"
          onClick={handleDontAsk}
          disabled={state.downloading}
        >
          Don&apos;t ask again
        </Button>
        <Box flexGrow={1} />
        <Button onClick={onLater} disabled={state.downloading}>
          Later
        </Button>
        <Button
          variant="contained"
          onClick={handleDownload}
          disabled={state.downloading}
        >
          {state.downloading ? 'Downloading…' : 'Download now'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="baseline">
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ width: 64, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography component="span" variant="body2">
        {children}
      </Typography>
    </Stack>
  );
}
