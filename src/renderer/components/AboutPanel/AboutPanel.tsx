import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import { AppInfo, ipc } from '../DocPanel/docApi';

const REPO_URL = 'https://github.com/Araw86/stm32_pomohlo_tool';

function AboutPanel(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await ipc()?.appInfo();
      if (!cancelled && res) setInfo(res);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // We deliberately don't use a plain <a href> — Electron's renderer would
  // try to open it in a new BrowserWindow. Route through the main process
  // so the URL opens in the user's default browser.
  const openRepo = (e: React.MouseEvent) => {
    e.preventDefault();
    void ipc()?.openExternal(REPO_URL);
  };

  return (
    <Box m={2} display="flex" justifyContent="center">
      <Paper sx={{ p: 3, maxWidth: 720, width: '100%' }}>
        <Typography variant="h6" gutterBottom>
          About
        </Typography>

        <Stack spacing={1} sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>{info?.name ?? 'stm32_pomohlo_tool'}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Version{' '}
            <Box component="span" sx={{ fontFamily: 'monospace' }}>
              {info?.version ?? '…'}
            </Box>
          </Typography>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Source code
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<GitHubIcon />}
            onClick={openRepo}
            sx={{ flexShrink: 0 }}
          >
            Open on GitHub
          </Button>
          <Link
            href={REPO_URL}
            onClick={openRepo}
            underline="hover"
            sx={{ wordBreak: 'break-all' }}
          >
            {REPO_URL}
          </Link>
        </Stack>

        {info && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Runtime
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ color: 'text.secondary' }}
            >
              <Typography variant="caption">
                Electron{' '}
                <Box component="span" sx={{ fontFamily: 'monospace' }}>
                  {info.electron}
                </Box>
              </Typography>
              <Typography variant="caption">
                Chromium{' '}
                <Box component="span" sx={{ fontFamily: 'monospace' }}>
                  {info.chrome}
                </Box>
              </Typography>
              <Typography variant="caption">
                Node{' '}
                <Box component="span" sx={{ fontFamily: 'monospace' }}>
                  {info.node}
                </Box>
              </Typography>
            </Stack>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default AboutPanel;
