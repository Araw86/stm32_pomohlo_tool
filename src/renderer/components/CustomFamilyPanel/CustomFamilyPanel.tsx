import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import {
  CustomFamilyPayload,
  CustomFamilySummary,
  ipc,
} from '../DocPanel/docApi';
import { AddDocumentDialog } from './AddDocumentDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { TextPromptDialog } from './TextPromptDialog';

function CustomFamilyPanel(): JSX.Element {
  const repoPath = useSelector((s: RootState) => s.configSlice.repoPath);

  const [families, setFamilies] = useState<CustomFamilySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payload, setPayload] = useState<CustomFamilyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Dialog state -- one bag of optional state per dialog kind keeps the
  // component readable without yet another sub-state-machine.
  const [createOpen, setCreateOpen] = useState(false);
  const [renameFamilyOpen, setRenameFamilyOpen] = useState(false);
  const [deleteFamilyOpen, setDeleteFamilyOpen] = useState(false);

  const [addSubOpen, setAddSubOpen] = useState(false);
  const [renameSub, setRenameSub] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteSub, setDeleteSub] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [addDevice, setAddDevice] = useState<{ subId: string } | null>(null);
  const [renameDev, setRenameDev] = useState<{ id: string } | null>(null);
  const [deleteDev, setDeleteDev] = useState<{ id: string } | null>(null);

  const [addDoc, setAddDoc] = useState<{
    subId: string;
    deviceId: string;
  } | null>(null);
  const [renameDoc, setRenameDoc] = useState<{
    id: string;
    title: string;
    type: string;
    version: string;
  } | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Refresh the family list. Optionally point at a specific family after.
  const refreshList = async (selectAfter?: string) => {
    const res = await ipc()?.listCustomFamilies();
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setFamilies(res.families);
    if (selectAfter) {
      setSelectedId(selectAfter);
    } else if (selectedId && !res.families.some((f) => f.id === selectedId)) {
      setSelectedId(res.families[0]?.id ?? null);
    } else if (!selectedId && res.families.length > 0) {
      setSelectedId(res.families[0].id);
    }
  };

  useEffect(() => {
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the selected family's full payload.
  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setPayload(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const res = await ipc()?.loadCustomFamily(selectedId);
      if (cancelled || !res) return;
      if (res.ok === false) {
        setPayload(null);
        setError(res.message);
        return;
      }
      setPayload(res.payload);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleCreate = async (name: string) => {
    setError(null);
    const res = await ipc()?.createCustomFamily(name);
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setCreateOpen(false);
    setInfo(`Created family '${res.payload.family.name}'.`);
    await refreshList(res.payload.family.id);
  };

  const handleRenameFamily = async (newName: string) => {
    if (!selectedId) return;
    setError(null);
    const res = await ipc()?.renameCustomFamily(selectedId, newName);
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setRenameFamilyOpen(false);
    setPayload(res.payload);
    await refreshList(res.payload.family.id);
  };

  const handleDeleteFamily = async (deletePdfs: boolean) => {
    if (!selectedId) return;
    setError(null);
    const res = await ipc()?.deleteCustomFamily(selectedId, deletePdfs);
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setDeleteFamilyOpen(false);
    setSelectedId(null);
    setPayload(null);
    const msg = deletePdfs
      ? `Deleted family. Removed ${res.removedPdfs.length} PDF(s)${
          res.missingPdfs.length > 0
            ? ` (${res.missingPdfs.length} were already missing)`
            : ''
        }.`
      : 'Deleted family. PDFs left in the repository.';
    setInfo(msg);
    await refreshList();
  };

  const handleExport = async () => {
    if (!selectedId || !payload) return;
    setError(null);
    const dlg = await ipc()?.saveZipFile(`${payload.family.id}.zip`);
    if (!dlg || dlg.canceled || !dlg.path) return;
    const res = await ipc()?.exportCustomFamily(selectedId, dlg.path);
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setInfo(`Exported ${res.documentCount} document(s) to ${res.zipPath}.`);
  };

  const handleImport = async () => {
    setError(null);
    const dlg = await ipc()?.pickZipFile();
    if (!dlg || dlg.canceled || dlg.paths.length === 0) return;
    const res = await ipc()?.importCustomFamily(dlg.paths[0]);
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setInfo(
      `Imported '${res.familyName}': ${res.importedPdfs} new PDF(s)${
        res.skippedExistingPdfs > 0
          ? `, ${res.skippedExistingPdfs} already in repo (matched)`
          : ''
      }.`,
    );
    await refreshList(res.familyId);
  };

  // Subfamily ops
  const handleAddSubfamily = async (name: string) => {
    if (!selectedId) return;
    setError(null);
    const res = await ipc()?.addCustomSubfamily(selectedId, name);
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setAddSubOpen(false);
    setPayload(res.payload);
  };

  const handleRenameSubfamily = async (newName: string) => {
    if (!selectedId || !renameSub) return;
    const res = await ipc()?.renameCustomSubfamily(
      selectedId,
      renameSub.id,
      newName,
    );
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setRenameSub(null);
    setPayload(res.payload);
  };

  const handleDeleteSubfamily = async (deletePdfs: boolean) => {
    if (!selectedId || !deleteSub) return;
    const res = await ipc()?.deleteCustomSubfamily(
      selectedId,
      deleteSub.id,
      deletePdfs,
    );
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setDeleteSub(null);
    if (res.payload) setPayload(res.payload);
    setInfo(
      deletePdfs
        ? `Subfamily removed. ${res.removedPdfs.length} PDF(s) deleted.`
        : 'Subfamily removed.',
    );
    await refreshList(selectedId);
  };

  // Device ops
  const handleAddDevice = async (name: string) => {
    if (!selectedId || !addDevice) return;
    const res = await ipc()?.addCustomDevice(selectedId, addDevice.subId, name);
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setAddDevice(null);
    setPayload(res.payload);
  };

  const handleRenameDevice = async (newName: string) => {
    if (!selectedId || !renameDev) return;
    const res = await ipc()?.renameCustomDevice(
      selectedId,
      renameDev.id,
      newName,
    );
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setRenameDev(null);
    setPayload(res.payload);
  };

  const handleDeleteDevice = async (deletePdfs: boolean) => {
    if (!selectedId || !deleteDev) return;
    const res = await ipc()?.deleteCustomDevice(
      selectedId,
      deleteDev.id,
      deletePdfs,
    );
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setDeleteDev(null);
    if (res.payload) setPayload(res.payload);
    setInfo(
      deletePdfs
        ? `Device removed. ${res.removedPdfs.length} PDF(s) deleted.`
        : 'Device removed.',
    );
    await refreshList(selectedId);
  };

  // Doc ops
  const handleDeleteDocument = async (deletePdf: boolean) => {
    if (!selectedId || !deleteDoc) return;
    const res = await ipc()?.deleteCustomDocument(
      selectedId,
      deleteDoc.id,
      deletePdf,
    );
    if (!res) return;
    if (res.ok === false) {
      setError(res.message);
      return;
    }
    setDeleteDoc(null);
    if (res.payload) setPayload(res.payload);
    setInfo(
      deletePdf && res.removedPdf
        ? `Document removed and PDF deleted.`
        : 'Document removed. PDF kept in the repository.',
    );
    await refreshList(selectedId);
  };

  return (
    <Box m={2} display="flex" justifyContent="center">
      <Paper sx={{ p: 3, maxWidth: 1100, width: '100%' }}>
        <Typography variant="h6" gutterBottom>
          Custom family
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Build your own family / subfamily / device tree and attach local
          PDFs. Files are copied into the local repository under the document
          id you choose.
        </Typography>

        {!repoPath && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Pick a local repository on the Settings tab before adding documents.
          </Alert>
        )}

        {/* Top bar -- family selector + actions. Wrap on narrow widths so
            no button gets squeezed past its label. */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
          sx={{ mb: 2 }}
        >
          <Select
            size="small"
            value={selectedId ?? ''}
            displayEmpty
            onChange={(e) => setSelectedId(e.target.value || null)}
            sx={{ minWidth: 240, flexShrink: 0 }}
            renderValue={(val) => {
              if (!val) return <em>-- select family --</em>;
              const sum = families.find((f) => f.id === val);
              return sum ? sum.name : (val as string);
            }}
          >
            <MenuItem value="">
              <em>-- select family --</em>
            </MenuItem>
            {families.map((f) => (
              <MenuItem key={f.id} value={f.id}>
                {f.name}{' '}
                <Chip
                  size="small"
                  label={`${f.documentCount} docs`}
                  sx={{ ml: 1 }}
                />
              </MenuItem>
            ))}
          </Select>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            New
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={handleImport}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Import...
          </Button>
          {selectedId && (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setRenameFamilyOpen(true)}
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                Rename
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                Export
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteFamilyOpen(true)}
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                Delete
              </Button>
            </>
          )}
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {info && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>
            {info}
          </Alert>
        )}

        {payload && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              {payload.family.name}{' '}
              <Typography component="span" color="text.secondary" variant="body2">
                ({payload.family.id})
              </Typography>
            </Typography>

            {payload.subfamilies.map((sub) => (
              <Paper
                key={sub.id}
                variant="outlined"
                sx={{ p: 2, mb: 2 }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                    Subfamily: <strong>{sub.name}</strong>{' '}
                    <Typography component="span" color="text.secondary" variant="caption">
                      ({sub.id})
                    </Typography>
                  </Typography>
                  <Tooltip title="Add device">
                    <IconButton
                      size="small"
                      onClick={() => setAddDevice({ subId: sub.id })}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Rename subfamily">
                    <IconButton
                      size="small"
                      onClick={() => setRenameSub({ id: sub.id, name: sub.name })}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete subfamily">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteSub({ id: sub.id, name: sub.name })}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Divider sx={{ my: 1 }} />
                {payload.devices
                  .filter((d) => d.subfamilyId === sub.id)
                  .map((dev) => {
                    const docIds = new Set<string>();
                    if (dev.datasheetId) docIds.add(dev.datasheetId);
                    for (const id of dev.documentIds ?? []) docIds.add(id);
                    const docs = payload.documents.filter((d) =>
                      docIds.has(d.id),
                    );
                    return (
                      <Box
                        key={dev.id}
                        sx={{ ml: 2, mb: 1, pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" sx={{ flexGrow: 1 }}>
                            Device: <strong>{dev.id}</strong>
                          </Typography>
                          <Tooltip title="Add document">
                            <IconButton
                              size="small"
                              disabled={!repoPath}
                              onClick={() =>
                                setAddDoc({
                                  subId: sub.id,
                                  deviceId: dev.id,
                                })
                              }
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Rename device">
                            <IconButton
                              size="small"
                              onClick={() => setRenameDev({ id: dev.id })}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete device">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteDev({ id: dev.id })}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                        {docs.length === 0 && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ ml: 1 }}
                          >
                            no documents yet
                          </Typography>
                        )}
                        {docs.map((d) => {
                          const live = d.versions[d.versions.length - 1];
                          return (
                            <Stack
                              key={d.id}
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ ml: 1, mt: 0.5 }}
                            >
                              <Chip size="small" label={d.type} />
                              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                <strong>{d.id}</strong> · {d.title || '--'}
                                {live ? (
                                  <Typography
                                    component="span"
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ ml: 1 }}
                                  >
                                    v{live.version}
                                  </Typography>
                                ) : null}
                              </Typography>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setRenameDoc({
                                      id: d.id,
                                      title: d.title,
                                      type: d.type,
                                      version: live?.version ?? '',
                                    })
                                  }
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    setDeleteDoc({ id: d.id, title: d.title })
                                  }
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          );
                        })}
                      </Box>
                    );
                  })}
              </Paper>
            ))}

            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddSubOpen(true)}
            >
              Add subfamily
            </Button>
          </Box>
        )}

        {!payload && families.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No custom families yet. Click <strong>New</strong> to create one,
            or <strong>Import...</strong> to load a previously exported zip.
          </Typography>
        )}
      </Paper>

      {/* Dialogs */}
      <TextPromptDialog
        open={createOpen}
        title="New custom family"
        label="Family name"
        helperText="Used for the folder name and as the default subfamily/device names."
        onCancel={() => setCreateOpen(false)}
        onConfirm={handleCreate}
      />
      <TextPromptDialog
        open={renameFamilyOpen}
        title="Rename family"
        label="Family name"
        defaultValue={payload?.family.name ?? ''}
        helperText="Folder id stays the same; only the display name changes."
        onCancel={() => setRenameFamilyOpen(false)}
        onConfirm={handleRenameFamily}
      />
      <ConfirmDialog
        open={deleteFamilyOpen}
        title="Delete custom family"
        message={
          <>
            Delete <strong>{payload?.family.name ?? ''}</strong>?<br />
            The local PDFs in your repository can be kept or deleted.
          </>
        }
        confirmLabel="Delete"
        showKeepPdfsToggle
        keepLabel="Keep PDFs in the repository"
        deleteLabel="Also delete the PDFs"
        onCancel={() => setDeleteFamilyOpen(false)}
        onConfirm={handleDeleteFamily}
      />

      <TextPromptDialog
        open={addSubOpen}
        title="Add subfamily"
        label="Subfamily name"
        onCancel={() => setAddSubOpen(false)}
        onConfirm={handleAddSubfamily}
      />
      <TextPromptDialog
        open={renameSub !== null}
        title="Rename subfamily"
        label="Subfamily name"
        defaultValue={renameSub?.name ?? ''}
        onCancel={() => setRenameSub(null)}
        onConfirm={handleRenameSubfamily}
      />
      <ConfirmDialog
        open={deleteSub !== null}
        title="Delete subfamily"
        message={
          <>
            Delete subfamily <strong>{deleteSub?.name ?? ''}</strong>? Devices
            and exclusive documents under it will go away.
          </>
        }
        confirmLabel="Delete"
        showKeepPdfsToggle
        onCancel={() => setDeleteSub(null)}
        onConfirm={handleDeleteSubfamily}
      />

      <TextPromptDialog
        open={addDevice !== null}
        title="Add device"
        label="Device name (id)"
        helperText="The id is also the device's display name (e.g. STM32F405RG)."
        onCancel={() => setAddDevice(null)}
        onConfirm={handleAddDevice}
      />
      <TextPromptDialog
        open={renameDev !== null}
        title="Rename device"
        label="Device name (id)"
        defaultValue={renameDev?.id ?? ''}
        onCancel={() => setRenameDev(null)}
        onConfirm={handleRenameDevice}
      />
      <ConfirmDialog
        open={deleteDev !== null}
        title="Delete device"
        message={
          <>
            Delete device <strong>{deleteDev?.id ?? ''}</strong>? Documents
            referenced only by this device will go away.
          </>
        }
        confirmLabel="Delete"
        showKeepPdfsToggle
        onCancel={() => setDeleteDev(null)}
        onConfirm={handleDeleteDevice}
      />

      {addDoc && payload && (
        <AddDocumentDialog
          open
          familyId={payload.family.id}
          subfamilyId={addDoc.subId}
          deviceId={addDoc.deviceId}
          payload={payload}
          onCancel={() => setAddDoc(null)}
          onAdded={(updated) => {
            setAddDoc(null);
            setPayload(updated);
            void refreshList(updated.family.id);
          }}
          setError={setError}
        />
      )}

      {renameDoc && payload && (
        <RenameDocumentDialog
          open
          familyId={payload.family.id}
          docId={renameDoc.id}
          initialTitle={renameDoc.title}
          initialType={renameDoc.type}
          initialVersion={renameDoc.version}
          onCancel={() => setRenameDoc(null)}
          onSaved={(updated) => {
            setRenameDoc(null);
            setPayload(updated);
          }}
          setError={setError}
        />
      )}

      <ConfirmDialog
        open={deleteDoc !== null}
        title="Delete document"
        message={
          <>
            Delete <strong>{deleteDoc?.id ?? ''}</strong>
            {deleteDoc?.title ? ` (${deleteDoc.title})` : ''}?
          </>
        }
        confirmLabel="Delete"
        showKeepPdfsToggle
        keepLabel="Keep PDF in the repository"
        deleteLabel="Also delete the PDF"
        onCancel={() => setDeleteDoc(null)}
        onConfirm={handleDeleteDocument}
      />
    </Box>
  );
}

/* ------- inline rename document dialog (lighter than the add flow) ------- */

import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

// Match scraped DB values exactly so DocPanel renders the right kind chips.
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

function RenameDocumentDialog(props: {
  open: boolean;
  familyId: string;
  docId: string;
  initialTitle: string;
  initialType: string;
  initialVersion: string;
  onCancel: () => void;
  onSaved: (payload: CustomFamilyPayload) => void;
  setError: (s: string | null) => void;
}): JSX.Element {
  const [title, setTitle] = useState(props.initialTitle);
  const [type, setType] = useState(props.initialType);
  const [version, setVersion] = useState(props.initialVersion);

  const handleSave = async () => {
    props.setError(null);
    const res = await ipc()?.renameCustomDocument({
      familyId: props.familyId,
      docId: props.docId,
      title,
      type,
      version,
    });
    if (!res) return;
    if (res.ok === false) {
      props.setError(res.message);
      return;
    }
    props.onSaved(res.payload);
  };

  return (
    <Dialog open={props.open} onClose={props.onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Edit document -- {props.docId}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Title / description"
            size="small"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
            label="Version label"
            size="small"
            fullWidth
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CustomFamilyPanel;

