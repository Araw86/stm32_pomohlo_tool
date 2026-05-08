import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
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
import { lightGreen, deepOrange, blueGrey } from '@mui/material/colors';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';

import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import type {
  Board,
  BoardSchematic,
  Device,
  Subfamily,
} from '../../../shared/types/database';
import { ipc } from './docApi';

interface Props {
  subfamily: Subfamily;
  open: boolean;
  onClose: () => void;
}

/** Boards that support at least one device from `subfamily`. */
function buildSubfamilyBoards(
  subfamily: Subfamily,
  devices: Device[],
  boards: Board[],
): Board[] {
  const subfamilyDeviceIds = new Set(
    devices.filter((d) => d.subfamilyId === subfamily.id).map((d) => d.id),
  );
  if (subfamilyDeviceIds.size === 0) return [];
  const matching = boards.filter((b) =>
    b.deviceIds.some((id) => subfamilyDeviceIds.has(id)),
  );
  matching.sort((a, b) => a.name.localeCompare(b.name));
  return matching;
}

function DocPanelBoardsDialog({
  subfamily,
  open,
  onClose,
}: Props): JSX.Element {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const mainDevices = useSelector((s: RootState) => s.databaseSlice.devices);
  const boards = useSelector((s: RootState) => s.databaseSlice.boards);
  const customFamilies = useSelector(
    (s: RootState) => s.customFamiliesSlice.families,
  );

  const allDevices = useMemo<Device[]>(() => {
    if (customFamilies.length === 0) return mainDevices;
    const out = [...mainDevices];
    for (const cf of customFamilies) out.push(...cf.devices);
    return out;
  }, [mainDevices, customFamilies]);

  const matchingBoards = useMemo(
    () => buildSubfamilyBoards(subfamily, allDevices, boards),
    [subfamily, allDevices, boards],
  );

  const filteredBoards = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return matchingBoards;
    return matchingBoards.filter((b) => {
      if (b.name.toUpperCase().includes(q)) return true;
      if (b.id.toUpperCase().includes(q)) return true;
      if (b.type.toUpperCase().includes(q)) return true;
      return b.schematics.some(
        (s) =>
          s.id.toUpperCase().includes(q) ||
          s.title.toUpperCase().includes(q),
      );
    });
  }, [matchingBoards, search]);

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
            <span>Boards</span>
            <Typography variant="caption" color="text.secondary">
              {subfamily.name} · {filteredBoards.length} of {matchingBoards.length}{' '}
              board{matchingBoards.length === 1 ? '' : 's'}
            </Typography>
          </Stack>
          <TextField
            size="small"
            placeholder="Filter by name, id, type, schematic"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputRef={inputRef}
            autoFocus
            sx={{ minWidth: 320 }}
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
        {filteredBoards.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            {matchingBoards.length === 0
              ? 'No boards match this subfamily.'
              : 'No boards match the current filter.'}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {filteredBoards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function BoardCard({ board }: { board: Board }): JSX.Element {
  const handleOpenProductPage = (e: React.MouseEvent) => {
    e.preventDefault();
    if (board.url) void ipc()?.openExternal(board.url);
  };

  return (
    <Stack
      spacing={1}
      sx={{
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Avatar sx={{ bgcolor: lightGreen[700], color: 'black !important' }}>
          <DeveloperBoardIcon />
        </Avatar>
        <Stack sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1">{board.name}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={board.type} />
            <Typography variant="caption" color="text.secondary">
              {board.deviceIds.length} compatible device
              {board.deviceIds.length === 1 ? '' : 's'}
            </Typography>
          </Stack>
        </Stack>
        {board.url && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={handleOpenProductPage}
            sx={{ flexShrink: 0 }}
          >
            Product page
          </Button>
        )}
      </Stack>
      {board.schematics.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ pl: 7 }}>
          No schematics published.
        </Typography>
      ) : (
        <List dense disablePadding>
          {board.schematics.map((s) => (
            <SchematicItem key={s.id} schematic={s} />
          ))}
        </List>
      )}
    </Stack>
  );
}

function SchematicItem({
  schematic,
}: {
  schematic: BoardSchematic;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // PDFs are downloaded into the local repository so they behave like every
  // other document. ZIPs only get a "Open" that hands off to the user's
  // browser — schematic packs are big and we don't archive them locally.
  const isPdf = schematic.format.toUpperCase() === 'PDF';
  const isZip = schematic.format.toUpperCase() === 'ZIP';

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isPdf) {
        const result = await ipc()?.openOrDownload(
          schematic.id,
          schematic.url,
          {
            version: schematic.version,
            lastUpdate: schematic.lastUpdate,
            pdfCreated: schematic.pdfCreated,
          },
        );
        if (result?.status === 'error') {
          setErrorMsg(result.message ?? 'Failed to open schematic.');
        }
      } else {
        // ZIP (or any non-PDF) — just open the source URL.
        const r = await ipc()?.openExternal(schematic.url);
        if (r && r.ok === false) setErrorMsg(r.message);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    void navigator.clipboard.writeText(schematic.url);
    setSnackbarOpen(true);
  };

  const formatColor = isPdf ? deepOrange[700] : blueGrey[600];

  return (
    <ListItem disableGutters>
      <ListItemButton onClick={handleClick} onContextMenu={handleRightClick}>
        <ListItemAvatar>
          <Avatar
            sx={{ bgcolor: formatColor, color: 'white !important' }}
            variant="rounded"
          >
            {busy ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
              schematic.format.toUpperCase()
            )}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Stack
              direction="row"
              spacing={1}
              alignItems="baseline"
              flexWrap="wrap"
            >
              <Typography component="span" variant="body2">
                <strong>{schematic.id}</strong>
                {schematic.version ? ` · v${schematic.version}` : ''}
              </Typography>
              {schematic.lastUpdate && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                >
                  · {schematic.lastUpdate}
                </Typography>
              )}
              {isZip && (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                >
                  · opens in browser (zip not stored locally)
                </Typography>
              )}
            </Stack>
          }
          secondary={
            <>
              <Typography component="span" variant="body2">
                {schematic.title}
              </Typography>
              <br />
              <Link
                component="a"
                href={schematic.url}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void ipc()?.openExternal(schematic.url);
                }}
                variant="caption"
                sx={{ wordBreak: 'break-all' }}
              >
                {schematic.url}
              </Link>
            </>
          }
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

export default DocPanelBoardsDialog;
