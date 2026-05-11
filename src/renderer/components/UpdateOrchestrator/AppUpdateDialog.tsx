import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import type { AutoUpdateEvent } from '../DocPanel/docApi';

export type AppUpdatePhase =
  | { kind: 'available'; info: Extract<AutoUpdateEvent, { kind: 'available' }>['info']; progress?: ProgressInfo }
  | { kind: 'downloaded'; info: Extract<AutoUpdateEvent, { kind: 'downloaded' }>['info'] }
  | { kind: 'error'; message: string };

export interface ProgressInfo {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

interface Props {
  phase: AppUpdatePhase | null;
  onInstallNow: () => void;
  onDismiss: () => void;
}

/** Replaces the old native Electron auto-update dialog. Stays open through
 *  the whole download phase, then flips to "Restart now / Later" once the
 *  update is on disk. Dismissing (X / Later / OK on error) hands control to
 *  the parent so it can move on to the database-update step. */
export function AppUpdateDialog({
  phase,
  onInstallNow,
  onDismiss,
}: Props): JSX.Element | null {
  if (!phase) return null;

  if (phase.kind === 'available') {
    const { info, progress } = phase;
    return (
      <Dialog open onClose={onDismiss} fullWidth maxWidth="sm">
        <DialogTitle>Application update available</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              Version <strong>{info.version}</strong>
              {info.releaseDate
                ? ` (released ${info.releaseDate.slice(0, 10)})`
                : ''}{' '}
              is being downloaded. The app will keep running — you'll be
              asked to restart when the download finishes.
            </Typography>
            {progress ? (
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, progress.percent))}
                  sx={{ height: 8, borderRadius: 1 }}
                />
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ mt: 0.5 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {formatBytes(progress.transferred)} /{' '}
                    {formatBytes(progress.total)} ·{' '}
                    {formatBytes(progress.bytesPerSecond)}/s
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {progress.percent.toFixed(0)}%
                  </Typography>
                </Stack>
              </Box>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Starting download…
                </Typography>
              </Stack>
            )}
            {info.releaseNotes && (
              <ReleaseNotesPreview notes={info.releaseNotes} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onDismiss}>Hide</Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (phase.kind === 'downloaded') {
    const { info } = phase;
    return (
      <Dialog open onClose={onDismiss} fullWidth maxWidth="sm">
        <DialogTitle>Update ready to install</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2">
              Version <strong>{info.version}</strong> has been downloaded.
              Restart the application to apply the update.
            </Typography>
            {info.releaseNotes && (
              <ReleaseNotesPreview notes={info.releaseNotes} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onDismiss}>Later</Button>
          <Button variant="contained" onClick={onInstallNow}>
            Restart now
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // error
  return (
    <Dialog open onClose={onDismiss} fullWidth maxWidth="sm">
      <DialogTitle>Update check failed</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 1 }}>
          The application could not check for updates.
        </Alert>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
        >
          {phase.message}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss}>OK</Button>
      </DialogActions>
    </Dialog>
  );
}

function ReleaseNotesPreview({ notes }: { notes: string }): JSX.Element {
  // Notes from electron-updater are often raw HTML. Show as plain text in
  // a bounded scroll area; HTML rendering would need sanitisation we don't
  // want to ship right now.
  const plain = notes.replace(/<[^>]*>/g, '').trim();
  if (!plain) return <></>;
  return (
    <Box
      sx={{
        maxHeight: 160,
        overflow: 'auto',
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: 'pre-wrap' }}
      >
        {plain}
      </Typography>
    </Box>
  );
}
