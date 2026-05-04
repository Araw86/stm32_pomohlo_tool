import React from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import { ipc } from '../DocPanel/docApi';

function SettingsPanel(): JSX.Element {
  const repoPath = useSelector((s: RootState) => s.configSlice.repoPath);

  const handleBrowse = async () => {
    try {
      await ipc()?.pickRepoPath();
    } catch (err) {
      console.error('pickRepoPath failed', err);
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
            >
              Browse…
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

export default SettingsPanel;
