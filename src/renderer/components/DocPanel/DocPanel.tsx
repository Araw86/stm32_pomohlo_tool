import React, { useMemo } from 'react';
import { Box, CircularProgress, Grid, Toolbar, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import type { DocumentEntry } from '../../../shared/types/database';
import DocPanelSubfamily from './DocPanelSubfamily';
import { useDatabaseLoader } from './useDatabaseLoader';

function DocPanel(): JSX.Element {
  useDatabaseLoader();

  const loaded = useSelector((s: RootState) => s.databaseSlice.loaded);
  const error = useSelector((s: RootState) => s.databaseSlice.error);
  const subfamilies = useSelector((s: RootState) => s.databaseSlice.subfamilies);
  const documents = useSelector((s: RootState) => s.databaseSlice.documents);

  const datasheetsBySubfamily = useMemo(() => {
    const map = new Map<string, DocumentEntry[]>();
    for (const doc of documents) {
      if (doc.type !== 'Datasheet') continue;
      for (const subfamilyId of doc.subfamilyIds) {
        const list = map.get(subfamilyId);
        if (list) list.push(doc);
        else map.set(subfamilyId, [doc]);
      }
    }
    return map;
  }, [documents]);

  if (error) {
    return (
      <Box m={2}>
        <Typography color="error">Failed to load database: {error}</Typography>
      </Box>
    );
  }

  if (!loaded) {
    return (
      <Box m={2} display="flex" alignItems="center" gap={2}>
        <CircularProgress size={24} />
        <Typography>Loading database…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Toolbar />
      <Box m={1}>
        <Grid container justifyContent="center" spacing={2}>
          {subfamilies.map((sf) => (
            <DocPanelSubfamily
              key={sf.id}
              subfamily={sf}
              datasheets={datasheetsBySubfamily.get(sf.id) ?? []}
            />
          ))}
        </Grid>
      </Box>
    </Box>
  );
}

export default DocPanel;
