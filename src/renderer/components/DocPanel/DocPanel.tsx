import React, { useMemo, useState } from 'react';
import { Box, CircularProgress, Grid, Typography } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import type { Device, DocumentEntry, Subfamily } from '../../../shared/types/database';
import DocPanelSubfamily, { DocGroup } from './DocPanelSubfamily';
import DocPanelSearch from './DocPanelSearch';
import { useDatabaseLoader } from './useDatabaseLoader';
import { DocKind, KIND_BY_DOCTYPE, KIND_ORDER } from './docKinds';

interface VisibleRow {
  subfamily: Subfamily;
  groups: DocGroup[];
  totalDevices: number;
}

const NO_DS_KEY = '__no_ds__';

function buildGroupsForSubfamily(
  subfamily: Subfamily,
  devices: Device[],
  documentsById: Map<string, DocumentEntry>,
): DocGroup[] {
  // key = `${kind}|${docId|NO_DS_KEY}`
  const buckets = new Map<string, DocGroup>();

  function bump(kind: DocKind, documentId: string | null, dev: Device) {
    const key = `${kind}|${documentId ?? NO_DS_KEY}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        kind,
        documentId,
        document: documentId ? documentsById.get(documentId) : undefined,
        devices: [],
      };
      buckets.set(key, bucket);
    }
    bucket.devices.push(dev);
  }

  for (const dev of devices) {
    // DS: per-device datasheetId (null when not deep-scraped yet).
    bump('DS', dev.datasheetId ?? null, dev);

    // RM/PM/ES: take device.documentIds when present, else inherit from
    // the subfamily. Filter to known doc records of supported types.
    const inheritedIds =
      dev.documentIds && dev.documentIds.length > 0
        ? dev.documentIds
        : subfamily.documentIds;
    const seenForThisDevice = new Set<string>();
    for (const id of inheritedIds) {
      if (seenForThisDevice.has(id)) continue;
      seenForThisDevice.add(id);
      const doc = documentsById.get(id);
      if (!doc) continue;
      const kind = KIND_BY_DOCTYPE[doc.type];
      if (!kind || kind === 'DS') continue; // DS already handled per-device above.
      bump(kind, id, dev);
    }
  }

  // Sort: by kind order, then by docId.
  return Array.from(buckets.values()).sort((a, b) => {
    const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (k !== 0) return k;
    const aId = a.documentId ?? '~~';
    const bId = b.documentId ?? '~~';
    return aId.localeCompare(bId);
  });
}

function DocPanel(): JSX.Element {
  useDatabaseLoader();

  const loaded = useSelector((s: RootState) => s.databaseSlice.loaded);
  const error = useSelector((s: RootState) => s.databaseSlice.error);
  const mainSubfamilies = useSelector((s: RootState) => s.databaseSlice.subfamilies);
  const mainDevices = useSelector((s: RootState) => s.databaseSlice.devices);
  const mainDocuments = useSelector((s: RootState) => s.databaseSlice.documents);
  const customFamilies = useSelector(
    (s: RootState) => s.customFamiliesSlice.families,
  );

  const [filter, setFilter] = useState('');

  // Flatten custom families and concatenate with the main DB, so the rest
  // of this panel can iterate a single list. IDs in custom families are
  // sanitised user input and don't collide with scraped ids.
  const subfamilies = useMemo<Subfamily[]>(() => {
    if (customFamilies.length === 0) return mainSubfamilies;
    const out = [...mainSubfamilies];
    for (const cf of customFamilies) out.push(...cf.subfamilies);
    return out;
  }, [mainSubfamilies, customFamilies]);

  const devices = useMemo<Device[]>(() => {
    if (customFamilies.length === 0) return mainDevices;
    const out = [...mainDevices];
    for (const cf of customFamilies) out.push(...cf.devices);
    return out;
  }, [mainDevices, customFamilies]);

  const documents = useMemo<DocumentEntry[]>(() => {
    if (customFamilies.length === 0) return mainDocuments;
    const out = [...mainDocuments];
    for (const cf of customFamilies) out.push(...cf.documents);
    return out;
  }, [mainDocuments, customFamilies]);

  const documentsById = useMemo(() => {
    const map = new Map<string, DocumentEntry>();
    for (const doc of documents) map.set(doc.id, doc);
    return map;
  }, [documents]);

  const devicesBySubfamily = useMemo(() => {
    const map = new Map<string, Device[]>();
    for (const dev of devices) {
      const list = map.get(dev.subfamilyId);
      if (list) list.push(dev);
      else map.set(dev.subfamilyId, [dev]);
    }
    return map;
  }, [devices]);

  const allGroupsBySubfamily = useMemo(() => {
    const map = new Map<string, DocGroup[]>();
    for (const sf of subfamilies) {
      const devs = devicesBySubfamily.get(sf.id) ?? [];
      map.set(sf.id, buildGroupsForSubfamily(sf, devs, documentsById));
    }
    return map;
  }, [subfamilies, devicesBySubfamily, documentsById]);

  const visibleRows = useMemo<VisibleRow[]>(() => {
    const query = filter.trim().toUpperCase();

    if (query === '') {
      return subfamilies.map((sf) => {
        const groups = allGroupsBySubfamily.get(sf.id) ?? [];
        const devs = devicesBySubfamily.get(sf.id) ?? [];
        return { subfamily: sf, groups, totalDevices: devs.length };
      });
    }

    const rows: VisibleRow[] = [];
    for (const sf of subfamilies) {
      const allGroups = allGroupsBySubfamily.get(sf.id) ?? [];
      const totalDevices = (devicesBySubfamily.get(sf.id) ?? []).length;

      // Specific match: a group's doc id matches OR any of its devices match.
      const matchingGroups = allGroups.filter((g) => {
        const docMatches = g.documentId?.toUpperCase().includes(query) ?? false;
        if (docMatches) return true;
        return g.devices.some((d) => d.id.toUpperCase().includes(query));
      });

      if (matchingGroups.length > 0) {
        rows.push({ subfamily: sf, groups: matchingGroups, totalDevices });
        continue;
      }

      // Fallback: surface the whole subfamily on a name/id match.
      const nameMatches =
        sf.name.toUpperCase().includes(query) || sf.id.toUpperCase().includes(query);
      if (nameMatches) {
        rows.push({ subfamily: sf, groups: allGroups, totalDevices });
      }
    }
    return rows;
  }, [subfamilies, allGroupsBySubfamily, devicesBySubfamily, filter]);

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
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.default',
          px: 1,
          pt: 1,
          pb: 2,
        }}
      >
        <DocPanelSearch value={filter} onChange={setFilter} />
      </Box>
      <Box sx={{ px: 1, pb: 1 }}>
        {visibleRows.length === 0 ? (
          <Box m={2}>
            <Typography color="text.secondary">
              No subfamilies match &ldquo;{filter}&rdquo;.
            </Typography>
          </Box>
        ) : (
          <Grid container justifyContent="center" spacing={2}>
            {visibleRows.map(({ subfamily, groups, totalDevices }) => (
              <DocPanelSubfamily
                key={subfamily.id}
                subfamily={subfamily}
                groups={groups}
                totalDevices={totalDevices}
              />
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}

export default DocPanel;
