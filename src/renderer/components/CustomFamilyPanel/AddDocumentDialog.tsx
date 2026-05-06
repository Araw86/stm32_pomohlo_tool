import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { CustomFamilyPayload, ipc } from '../DocPanel/docApi';

// Keep these strings identical to the scraped database values so the chip
// colours and "Other documentation" mapping in DocPanel pick them up.
const DOC_TYPES = [
  'Datasheet',
  'Reference Manual',
  'Programming Manual',
  'Errata Sheet',
  'Application Note',
  'Technical Note',
  'User Manual',
  'Other',
];

/** Strip extension, force uppercase-friendly id (alnum / `_` / `-`).
 *  Mirrors `sanitizeDocId` in the main process. */
function deriveDocId(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? '';
  return base
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function deriveTitle(filePath: string): string {
  const base = filePath.split(/[\\/]/).pop() ?? '';
  return base.replace(/\.pdf$/i, '').replace(/_/g, ' ').trim();
}

export function AddDocumentDialog(props: {
  open: boolean;
  familyId: string;
  subfamilyId: string;
  deviceId: string;
  onCancel: () => void;
  onAdded: (payload: CustomFamilyPayload) => void;
  setError: (s: string | null) => void;
}): JSX.Element {
  const [sourcePath, setSourcePath] = useState('');
  const [docId, setDocId] = useState('');
  const [type, setType] = useState<string>('Datasheet');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('1.0');
  const [submitting, setSubmitting] = useState(false);

  const handlePick = async () => {
    const res = await ipc()?.pickPdfFile();
    if (!res || res.canceled || res.paths.length === 0) return;
    const path = res.paths[0];
    setSourcePath(path);
    // Pre-fill the id and title from the filename -- but only if the user
    // hasn't already typed something custom. (Empty = derive; otherwise
    // leave the user's edit alone.)
    if (!docId) setDocId(deriveDocId(path));
    if (!title) setTitle(deriveTitle(path));
  };

  const canSubmit =
    sourcePath.length > 0 && docId.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    props.setError(null);
    setSubmitting(true);
    try {
      const res = await ipc()?.addCustomDocument({
        familyId: props.familyId,
        subfamilyId: props.subfamilyId,
        deviceId: props.deviceId,
        sourcePath,
        docId: docId.trim(),
        type,
        title: title.trim(),
        version: version.trim() || '1.0',
      });
      if (!res) return;
      if (res.ok === false) {
        props.setError(res.message);
        return;
      }
      props.onAdded(res.payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={props.open} onClose={props.onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Add document to {props.deviceId}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Source PDF"
              size="small"
              fullWidth
              value={sourcePath}
              placeholder="Pick a .pdf file..."
              InputProps={{ readOnly: true }}
            />
            <IconButton onClick={handlePick} title="Pick file">
              <FolderOpenIcon />
            </IconButton>
          </Stack>
          <TextField
            label="Document id"
            size="small"
            fullWidth
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            helperText="Used as the filename in the local repository (id.pdf)."
          />
          <TextField
            label="Type"
            size="small"
            select
            fullWidth
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {DOC_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Title / description"
            size="small"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label="Version label"
            size="small"
            fullWidth
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            helperText="Shown next to the document. Defaults to 1.0."
          />
          <Box>
            <Typography variant="caption" color="text.secondary">
              The PDF will be copied to the repository as{' '}
              <strong>{docId.trim() || '<id>'}.pdf</strong>.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

