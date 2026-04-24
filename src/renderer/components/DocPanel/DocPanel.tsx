import React, { useMemo, useState } from 'react';
import { Box, CircularProgress, Grid, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import type { DocumentEntry, Subfamily } from '../../../shared/types/database';
import DocPanelSubfamily from './DocPanelSubfamily';
import DocPanelSearch from './DocPanelSearch';
import { useDatabaseLoader } from './useDatabaseLoader';

interface VisibleRow {
  subfamily: Subfamily;
  datasheets: DocumentEntry[];
}

function DocPanel(): JSX.Element {
  useDatabaseLoader();

  const loaded = useSelector((s: RootState) => s.databaseSlice.loaded);
  const error = useSelector((s: RootState) => s.databaseSlice.error);
  const subfamilies = useSelector((s: RootState) => s.databaseSlice.subfamilies);
  const documents = useSelector((s: RootState) => s.databaseSlice.documents);

  const [filter, setFilter] = useState('');

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

  const visibleRows = useMemo<VisibleRow[]>(() => {
    const query = filter.trim().toUpperCase();

    if (query === '') {
      return subfamilies.map((sf) => ({
        subfamily: sf,
        datasheets: datasheetsBySubfamily.get(sf.id) ?? [],
      }));
    }

    const rows: VisibleRow[] = [];
    for (const sf of subfamilies) {
      const nameMatches = sf.name.toUpperCase().includes(query);
      const deviceMatches = sf.deviceIds.some((id) => id.toUpperCase().includes(query));

      const allDatasheets = datasheetsBySubfamily.get(sf.id) ?? [];
      const matchingDatasheets = allDatasheets.filter(
        (doc) =>
          doc.id.toUpperCase().includes(query) ||
          doc.title.toUpperCase().includes(query),
      );

      if (nameMatches || deviceMatches) {
        rows.push({ subfamily: sf, datasheets: allDatasheets });
      } else if (matchingDatasheets.length > 0) {
        rows.push({ subfamily: sf, datasheets: matchingDatasheets });
      }
    }
    return rows;
  }, [subfamilies, datasheetsBySubfamily, filter]);

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
    <Box m={1}>
      <Box mb={2}>
        <DocPanelSearch value={filter} onChange={setFilter} />
      </Box>
      {visibleRows.length === 0 ? (
        <Box m={2}>
          <Typography color="text.secondary">
            No subfamilies match &ldquo;{filter}&rdquo;.
          </Typography>
        </Box>
      ) : (
        <Grid container justifyContent="center" spacing={2}>
          {visibleRows.map(({ subfamily, datasheets }) => (
            <DocPanelSubfamily
              key={subfamily.id}
              subfamily={subfamily}
              datasheets={datasheets}
            />
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default DocPanel;
