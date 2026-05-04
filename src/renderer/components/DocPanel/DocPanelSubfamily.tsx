import React, { useState } from 'react';
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
import type { Device, DocumentEntry, Subfamily } from '../../../shared/types/database';
import DocPanelDocGroup from './DocPanelDocGroup';
import DocPanelOtherDocsDialog from './DocPanelOtherDocsDialog';
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
    </Grid>
  );
}

export default DocPanelSubfamily;
