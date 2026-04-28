import React, { Fragment, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Popover,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import type { Device, DocumentEntry } from '../../../shared/types/database';
import { ipc } from './docApi';
import { DocKind, KIND_COLORS, KIND_LONG_LABEL } from './docKinds';

interface Props {
  kind: DocKind;
  documentId: string | null;
  document: DocumentEntry | undefined;
  devices: Device[];
}

function DocPanelDocGroup({
  kind,
  documentId,
  document,
  devices,
}: Props): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const popoverOpen = Boolean(anchorEl);

  // For DS we may fall back to a per-device datasheetUrl when the document
  // record isn't known. RM/PM/ES rely on the document record's url.
  const fallbackUrl =
    kind === 'DS' ? devices.find((d) => d.datasheetUrl)?.datasheetUrl ?? null : null;
  const url = document?.url ?? fallbackUrl;
  const downloadId = documentId;
  const clickable = downloadId !== null && url !== null;

  const handleClick = async () => {
    if (!clickable || busy) return;
    setAnchorEl(null);
    setBusy(true);
    try {
      const meta = document
        ? { version: document.version, lastUpdate: document.lastUpdate }
        : undefined;
      const result = await ipc()?.openOrDownload(downloadId!, url!, meta);
      if (result?.status === 'error') {
        setErrorMsg(result.message ?? `Failed to open ${KIND_LONG_LABEL[kind]}`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!url) return;
    void navigator.clipboard.writeText(url);
    setAnchorEl(null);
    setCopyOpen(true);
  };

  const colors = KIND_COLORS[kind];
  const bg = clickable ? colors.bg : grey[600];
  const hover = clickable ? colors.hover : grey[600];

  return (
    <Fragment>
      <Avatar
        sx={{
          bgcolor: bg,
          color: 'white !important',
          cursor: clickable ? (busy ? 'progress' : 'pointer') : 'not-allowed',
          ':hover': { bgcolor: hover },
        }}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
        onMouseLeave={() => setAnchorEl(null)}
      >
        {busy ? <CircularProgress size={18} sx={{ color: 'white' }} /> : kind}
      </Avatar>

      <Popover
        sx={{ pointerEvents: 'none' }}
        open={popoverOpen}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClose={() => setAnchorEl(null)}
        disableRestoreFocus
      >
        <Box sx={{ p: 2, border: '3px dashed', borderColor: colors.bg, maxWidth: 520 }}>
          {document ? (
            <Fragment>
              <Typography>
                {document.id} — {KIND_LONG_LABEL[kind]}
              </Typography>
              <Typography variant="body2">{document.title}</Typography>
              <Typography variant="body2">Rev {document.version}</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Updated {document.lastUpdate}
              </Typography>
            </Fragment>
          ) : (
            <Typography variant="body2" sx={{ mb: 1 }} color="text.secondary">
              {documentId
                ? `${documentId} — ${KIND_LONG_LABEL[kind]}`
                : `No ${KIND_LONG_LABEL[kind].toLowerCase()} metadata available`}
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            {devices.length} device{devices.length === 1 ? '' : 's'}
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" mt={0.5}>
            {devices.map((dev) => (
              <Chip
                key={dev.id}
                label={dev.id}
                size="small"
                variant="outlined"
                sx={{ fontFamily: 'monospace' }}
              />
            ))}
          </Stack>
        </Box>
      </Popover>

      <Snackbar
        open={errorMsg !== null}
        onClose={() => setErrorMsg(null)}
        autoHideDuration={4000}
      >
        <Alert severity="error" variant="filled" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      </Snackbar>

      <Snackbar
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        autoHideDuration={2000}
      >
        <Alert severity="info" variant="filled">
          Link copied to clipboard
        </Alert>
      </Snackbar>
    </Fragment>
  );
}

export default DocPanelDocGroup;
