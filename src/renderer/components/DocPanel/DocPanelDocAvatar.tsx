import React, { Fragment, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  CircularProgress,
  Grid,
  Popover,
  Snackbar,
  Typography,
} from '@mui/material';
import { deepOrange, indigo } from '@mui/material/colors';
import type { DocumentEntry } from '../../../shared/types/database';
import { ipc } from './docApi';

interface Props {
  document: DocumentEntry;
}

function pickAvatarStyle(doc: DocumentEntry) {
  const isDataBrief = /data\s*brief/i.test(doc.title) || /\bDB\b/.test(doc.id);
  if (isDataBrief) {
    return {
      label: 'DB',
      longText: 'Data brief',
      color: indigo[700],
      hoverColor: indigo[900],
    };
  }
  return {
    label: 'DS',
    longText: 'Datasheet',
    color: deepOrange[700],
    hoverColor: deepOrange[900],
  };
}

function DocPanelDocAvatar({ document }: Props): JSX.Element {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { label, longText, color, hoverColor } = pickAvatarStyle(document);
  const open = Boolean(anchorEl);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setAnchorEl(null);
    try {
      const result = await ipc()?.openOrDownload(document.id, document.url);
      if (result?.status === 'error') {
        setErrorMsg(result.message ?? 'Failed to open document');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Fragment>
      <Grid item>
        <Avatar
          sx={{
            bgcolor: color,
            ':hover': { bgcolor: hoverColor },
            cursor: busy ? 'progress' : 'pointer',
          }}
          onClick={handleClick}
          onMouseEnter={(e) => !busy && setAnchorEl(e.currentTarget)}
          onMouseLeave={() => setAnchorEl(null)}
        >
          {busy ? <CircularProgress size={20} sx={{ color: 'white' }} /> : label}
        </Avatar>
        <Popover
          sx={{ pointerEvents: 'none' }}
          open={open}
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          onClose={() => setAnchorEl(null)}
          disableRestoreFocus
        >
          <Box sx={{ p: 2, border: '3px dashed', borderColor: color }}>
            <Typography>
              {document.id} — {longText}
            </Typography>
            <Typography variant="body2">{document.title}</Typography>
            <Typography variant="body2">Rev {document.version}</Typography>
            <Typography variant="body2">Updated {document.lastUpdate}</Typography>
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
      </Grid>
    </Fragment>
  );
}

export default DocPanelDocAvatar;
