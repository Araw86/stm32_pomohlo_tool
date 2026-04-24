import React, { Fragment, useState } from 'react';
import {
  Avatar,
  Box,
  Grid,
  Popover,
  Typography,
} from '@mui/material';
import { deepOrange, indigo } from '@mui/material/colors';
import type { DocumentEntry } from '../../../shared/types/database';

interface Props {
  document: DocumentEntry;
}

function pickAvatarStyle(doc: DocumentEntry) {
  // Treat "data brief" title marker separately like the old app did.
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
  const { label, longText, color, hoverColor } = pickAvatarStyle(document);
  const open = Boolean(anchorEl);

  return (
    <Fragment>
      <Grid item>
        <Avatar
          sx={{ bgcolor: color, ':hover': { bgcolor: hoverColor }, cursor: 'pointer' }}
          onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
          onMouseLeave={() => setAnchorEl(null)}
        >
          {label}
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
      </Grid>
    </Fragment>
  );
}

export default DocPanelDocAvatar;
