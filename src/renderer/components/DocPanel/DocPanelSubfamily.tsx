import React, { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/storeRenderer';
import type { Device, DocumentEntry, Subfamily } from '../../../shared/types/database';
import DocPanelDocGroup from './DocPanelDocGroup';
import DocPanelOtherDocsDialog from './DocPanelOtherDocsDialog';
import DocPanelBoardsDialog from './DocPanelBoardsDialog';
import { DocKind } from './docKinds';

export interface DocGroup {
  kind: DocKind;
  documentId: string | null;
  document: DocumentEntry | undefined;
  devices: Device[];
}

interface Props {
  subfamily: Subfamily;
  groups: DocGroup[];
  totalDevices: number;
}

function DocPanelSubfamily({ subfamily, groups, totalDevices }: Props): JSX.Element {
  const [otherOpen, setOtherOpen] = useState(false);
  const [boardsOpen, setBoardsOpen] = useState(false);

  // Hide the Boards button if there are no boards relevant to this subfamily
  // (older databases without boards.json, or subfamilies that just don't
  // have a Nucleo / Disco / Eval board associated).
  const allDevices = useSelector((s: RootState) => s.databaseSlice.devices);
  const allBoards = useSelector((s: RootState) => s.databaseSlice.boards);
  const boardCount = useMemo(() => {
    if (allBoards.length === 0) return 0;
    const subfamilyDeviceIds = new Set(
      allDevices.filter((d) => d.subfamilyId === subfamily.id).map((d) => d.id),
    );
    if (subfamilyDeviceIds.size === 0) return 0;
    let n = 0;
    for (const b of allBoards) {
      if (b.deviceIds.some((id) => subfamilyDeviceIds.has(id))) n++;
    }
    return n;
  }, [allDevices, allBoards, subfamily.id]);

  return (
    <Grid item xs={12} md={10} lg={8}>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" mb={1} spacing={1}>
            <Typography variant="h6" component="div">
              {subfamily.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              {totalDevices} device{totalDevices === 1 ? '' : 's'}
            </Typography>
            {boardCount > 0 && (
              <Tooltip
                title={`Compatible boards (${boardCount}) and their schematics`}
              >
                <IconButton
                  size="small"
                  aria-label="boards"
                  onClick={() => setBoardsOpen(true)}
                >
                  <DeveloperBoardIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Other documentation (application notes, technical notes, …)">
              <IconButton
                size="small"
                aria-label="other documentation"
                onClick={() => setOtherOpen(true)}
              >
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
          </Stack>
          {groups.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No documents match the current filter
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {groups.map((g) => (
                <DocPanelDocGroup
                  key={`${g.kind}|${g.documentId ?? '__none__'}`}
                  kind={g.kind}
                  documentId={g.documentId}
                  document={g.document}
                  devices={g.devices}
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
      <DocPanelOtherDocsDialog
        subfamily={subfamily}
        open={otherOpen}
        onClose={() => setOtherOpen(false)}
      />
      <DocPanelBoardsDialog
        subfamily={subfamily}
        open={boardsOpen}
        onClose={() => setBoardsOpen(false)}
      />
    </Grid>
  );
}

export default DocPanelSubfamily;
