import React from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import { ipc } from '../DocPanel/docApi';

function SettingsPanel(): JSX.Element {
  const repoPath = useSelector((s: RootState) => s.configSlice.repoPath);
  const versionCheckOnOpen = useSelector(
    (s: RootState) => s.configSlice.versionCheckOnOpen,
  );
  const checkDatabaseOnStartup = useSelector(
    (s: RootState) => s.configSlice.checkDatabaseOnStartup,
  );

  const handleBrowse = async () => {
    try {
      await ipc()?.pickRepoPath();
    } catch (err) {
      console.error('pickRepoPath failed', err);
    }
  };

  const handleVersionCheckToggle = async (
    _e: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => {
    try {
      await ipc()?.setVersionCheckOnOpen(checked);
    } catch (err) {
      console.error('setVersionCheckOnOpen failed', err);
    }
  };

  const handleStartupCheckToggle = async (
    _e: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ) => {
    try {
      await ipc()?.setCheckDatabaseOnStartup(checked);
    } catch (err) {
      console.error('setCheckDatabaseOnStartup failed', err);
    }
  };

  return (
    <Box m={2} display="flex" justifyContent="center">
      <Paper sx={{ p: 3, maxWidth: 720, width: '100%' }}>
        <Typography variant="h6" gutterBottom>
          Settings
        </Typography>

        <Box mt={3}>
          <Typography variant="subtitle1" gutterBottom>
            Local repository
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Folder where datasheets are downloaded and looked up. Files are named
            by document id, e.g. <code>DS13086.pdf</code>.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              value={repoPath ?? ''}
              placeholder="No folder selected"
              InputProps={{ readOnly: true }}
            />
            <Button
              variant="contained"
              startIcon={<FolderOpenIcon />}
              onClick={handleBrowse}
              sx={{ flexShrink: 0 }}
            >
              Browse…
            </Button>
          </Stack>
        </Box>

        <Box mt={4}>
          <Typography variant="subtitle1" gutterBottom>
            Version check on open
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            When you click a document that's already on disk, compare its
            stored PDF date with the database. If a newer version exists,
            ask whether to download it (the old PDF moves to{' '}
            <code>backup/</code>).
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={versionCheckOnOpen}
                onChange={handleVersionCheckToggle}
              />
            }
            label={
              versionCheckOnOpen
                ? 'Enabled — prompt when a newer version is available'
                : 'Disabled — always open the local copy without checking'
            }
          />
        </Box>

        <Box mt={4}>
          <Typography variant="subtitle1" gutterBottom>
            Check for database update on startup
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            When the app starts, query the database source for the latest
            release. If a newer release than the local copy is available,
            offer to download it.
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={checkDatabaseOnStartup}
                onChange={handleStartupCheckToggle}
              />
            }
            label={
              checkDatabaseOnStartup
                ? 'Enabled — notify on startup when a new release is available'
                : 'Disabled — never auto-check on startup'
            }
          />
        </Box>
      </Paper>
    </Box>
  );
}

export default SettingsPanel;
