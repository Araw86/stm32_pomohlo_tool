import React from 'react';
import { Button, Tooltip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import { ipc } from './docApi';

function formatPath(repoPath: string | null): string {
  if (!repoPath) return 'Select repo';
  if (repoPath.length <= 28) return repoPath;
  return '…' + repoPath.slice(repoPath.length - 27);
}

function DocPanelRepoButton(): JSX.Element {
  const repoPath = useSelector((s: RootState) => s.configSlice.repoPath);

  const handleClick = async () => {
    try {
      await ipc()?.pickRepoPath();
    } catch (err) {
      console.error('pickRepoPath failed', err);
    }
  };

  return (
    <Tooltip title={repoPath ?? 'No local repo selected — click to choose'}>
      <Button
        color="inherit"
        startIcon={<FolderIcon />}
        onClick={handleClick}
        sx={{ textTransform: 'none', maxWidth: 320 }}
      >
        {formatPath(repoPath)}
      </Button>
    </Tooltip>
  );
}

export default DocPanelRepoButton;
