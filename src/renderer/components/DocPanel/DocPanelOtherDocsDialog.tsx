import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { yellow } from '@mui/material/colors';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import type { Device, DocumentEntry, Subfamily } from '../../../shared/types/database';
import { ipc } from './docApi';
import { KIND_BY_DOCTYPE, shortLabelForType } from './docKinds';

interface Props {
  subfamily: Subfamily;
  open: boolean;
  onClose: () => void;
}

function buildOtherDocs(
  subfamily: Subfamily,
  devices: Device[],
  documentsById: Map<string, DocumentEntry>,
): DocumentEntry[] {
  const seen = new Set<string>();
  const out: DocumentEntry[] = [];
  for (const dev of devices) {
    const ids =
      dev.documentIds && dev.documentIds.length > 0
        ? dev.documentIds
        : subfamily.documentIds;
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const doc = documentsById.get(id);
      if (!doc) continue;
      // Exclude the four "main" kinds — those have their own card chips.
      if (KIND_BY_DOCTYPE[doc.type]) continue;
      out.push(doc);
    }
  }
  out.sort((a, b) => {
    const t = a.type.localeCompare(b.type);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
  return out;
}

function DocPanelOtherDocsDialog({
  subfamily,
  open,
  onClose,
}: Props): JSX.Element {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const allDevices = useSelector((s: RootState) => s.databaseSlice.devices);
  const documents = useSelector((s: RootState) => s.databaseSlice.documents);

  const subfamilyDevices = useMemo(
    () => allDevices.filter((d) => d.subfamilyId === subfamily.id),
    [allDevices, subfamily.id],
  );
  const documentsById = useMemo(() => {
    const map = new Map<string, DocumentEntry>();
    for (const d of documents) map.set(d.id, d);
    return map;
  }, [documents]);

  const allDocs = useMemo(
    () => buildOtherDocs(subfamily, subfamilyDevices, documentsById),
    [subfamily, subfamilyDevices, documentsById],
  );

  const filteredDocs = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return allDocs;
    return allDocs.filter(
      (d) => d.id.toUpperCase().includes(q) || d.title.toUpperCase().includes(q),
    );
  }, [allDocs, search]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      scroll="paper"
      maxWidth="md"
      fullWidth
      disableRestoreFocus
    >
      <DialogTitle>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
        >
          <Stack direction="column">
            <span>Other documentation</span>
            <Typography variant="caption" color="text.secondary">
              {subfamily.name} · {filteredDocs.length} of {allDocs.length} document
              {allDocs.length === 1 ? '' : 's'}
            </Typography>
          </Stack>
          <TextField
            size="small"
            placeholder="Filter by id or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputRef={inputRef}
            autoFocus
            sx={{ minWidth: 280 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    edge="end"
                    onClick={() => {
                      setSearch('');
                      inputRef.current?.focus();
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {filteredDocs.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            No documents match the current filter.
          </Typography>
        ) : (
          <List>
            {filteredDocs.map((doc) => (
              <DocPanelOtherDocsItem key={doc.id} doc={doc} />
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

interface ItemProps {
  doc: DocumentEntry;
}

function DocPanelOtherDocsItem({ doc }: ItemProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await ipc()?.openOrDownload(doc.id, doc.url, {
        version: doc.version,
        lastUpdate: doc.lastUpdate,
      });
      if (result?.status === 'error') {
        setErrorMsg(result.message ?? 'Failed to open document');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    void navigator.clipboard.writeText(doc.url);
    setSnackbarOpen(true);
  };

  const label = shortLabelForType(doc.type);

  return (
    <ListItem disableGutters>
      <ListItemButton onClick={handleClick} onContextMenu={handleRightClick}>
        <ListItemAvatar>
          <Avatar sx={{ bgcolor: yellow[700], color: 'black !important' }}>
            {busy ? <CircularProgress size={20} /> : label}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={`${doc.id} · ${doc.type} · rev ${doc.version}`}
          secondary={doc.title}
          sx={{ wordBreak: 'break-word' }}
        />
      </ListItemButton>
      <Snackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        autoHideDuration={2000}
      >
        <Alert variant="filled" severity="info">
          Link copied to clipboard
        </Alert>
      </Snackbar>
      <Snackbar
        open={errorMsg !== null}
        onClose={() => setErrorMsg(null)}
        autoHideDuration={4000}
      >
        <Alert severity="error" variant="filled" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      </Snackbar>
    </ListItem>
  );
}

export default DocPanelOtherDocsDialog;
