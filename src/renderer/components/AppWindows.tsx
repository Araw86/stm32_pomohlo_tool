import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import StorageIcon from '@mui/icons-material/Storage';

import DocPanel from './DocPanel/DocPanel';
import SettingsPanel from './SettingsPanel/SettingsPanel';
import DownloadPanel from './DownloadPanel/DownloadPanel';
import DatabasePanel from './DatabasePanel/DatabasePanel';

type TabKey = 'documents' | 'download' | 'database' | 'settings';

const SIDEBAR_WIDTH = 88;

function AppWindows(): JSX.Element {
  const [tab, setTab] = useState<TabKey>('documents');

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          orientation="vertical"
          value={tab}
          onChange={(_, next: TabKey) => setTab(next)}
          textColor="inherit"
          indicatorColor="secondary"
          sx={{
            '.MuiTab-root': {
              minHeight: 72,
              textTransform: 'none',
              fontSize: '0.75rem',
            },
          }}
        >
          <Tab value="documents" icon={<DescriptionIcon />} label="Documents" />
          <Tab value="download" icon={<CloudDownloadIcon />} label="Download" />
          <Tab value="database" icon={<StorageIcon />} label="Database" />
          <Tab value="settings" icon={<SettingsIcon />} label="Settings" />
        </Tabs>
      </Box>
      <Box sx={{ ml: `${SIDEBAR_WIDTH}px`, flexGrow: 1, minWidth: 0 }}>
        {tab === 'documents' && <DocPanel />}
        {tab === 'download' && <DownloadPanel />}
        {tab === 'database' && <DatabasePanel />}
        {tab === 'settings' && <SettingsPanel />}
      </Box>
    </Box>
  );
}

export default AppWindows;
