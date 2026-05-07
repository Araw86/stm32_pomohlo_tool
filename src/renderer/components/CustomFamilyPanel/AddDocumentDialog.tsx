import React, { useMemo, useState } from 'react';
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
  Tab,
  Tabs,
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

type Mode = 'new' | 'link';

export function AddDocumentDialog(props: {
  open: boolean;
  familyId: string;
  subfamilyId: string;
  deviceId: string;
  /** Full family payload — used to populate the "link existing" picker
   *  and to filter out docs the device is already attached to. */
  payload: CustomFamilyPayload;
  onCancel: () => void;
  onAdded: (payload: CustomFamilyPayload) => void;
  setError: (s: string | null) => void;
}): JSX.Element {
  const [mode, setMode] = useState<Mode>('new');

  // ---- "new PDF" state ----
  const [sourcePath, setSourcePath] = useState('');
  const [docId, setDocId] = useState('');
  const [type, setType] = useState<string>('Datasheet');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('1.0');

  // ---- "link existing" state ----
  const [pickedDocId, setPickedDocId] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);

  // Existing docs in this family that are NOT yet attached to this device.
  const linkableDocs = useMemo(() => {
    const dev = props.payload.devices.find((d) => d.id === props.deviceId);
    const alreadyOnDevice = new Set<string>();
    if (dev?.datasheetId) alreadyOnDevice.add(dev.datasheetId);
    for (const id of dev?.documentIds ?? []) alreadyOnDevice.add(id);
    return props.payload.documents.filter((d) => !alreadyOnDevice.has(d.id));
  }, [props.payload, props.deviceId]);

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
    !submitting &&
    (mode === 'new'
      ? sourcePath.length > 0 && docId.trim().length > 0
      : pickedDocId.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    props.setError(null);
    setSubmitting(true);
    try {
      const res =
        mode === 'new'
          ? await ipc()?.addCustomDocument({
              familyId: props.familyId,
              subfamilyId: props.subfamilyId,
              deviceId: props.deviceId,
              sourcePath,
              docId: docId.trim(),
              type,
              title: title.trim(),
              version: version.trim() || '1.0',
            })
          : await ipc()?.linkCustomDocument(
              props.familyId,
              props.deviceId,
              pickedDocId,
            );
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
        <Tabs
          value={mode}
          onChange={(_, m: Mode) => setMode(m)}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="new" label="Add new PDF" />
          <Tab
            value="link"
            label={`Link existing (${linkableDocs.length})`}
            disabled={linkableDocs.length === 0}
          />
        </Tabs>

        {mode === 'new' ? (
          <Stack spacing={2}>
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
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Attach a document already in this family to{' '}
              <strong>{props.deviceId}</strong>. The PDF stays where it is —
              only the device is wired to it.
            </Typography>
            <TextField
              label="Document"
              size="small"
              select
              fullWidth
              value={pickedDocId}
              onChange={(e) => setPickedDocId(e.target.value)}
              helperText={
                linkableDocs.length === 0
                  ? 'No other documents in this family.'
                  : 'Pick from documents already added to this family.'
              }
            >
              {linkableDocs.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <strong>{d.id}</strong>
                    <Typography variant="caption" color="text.secondary">
                      {d.type}
                      {d.title ? ` — ${d.title}` : ''}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onCancel}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {mode === 'new' ? 'Add' : 'Link'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
