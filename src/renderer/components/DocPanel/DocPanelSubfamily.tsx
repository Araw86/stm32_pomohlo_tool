import React from 'react';
import { Card, CardContent, Grid, Typography } from '@mui/material';
import type { DocumentEntry, Subfamily } from '../../../shared/types/database';
import DocPanelDocAvatar from './DocPanelDocAvatar';

interface Props {
  subfamily: Subfamily;
  datasheets: DocumentEntry[];
}

function DocPanelSubfamily({ subfamily, datasheets }: Props): JSX.Element {
  return (
    <Grid item sx={{ maxWidth: '100%' }}>
      <Card>
        <CardContent>
          <Typography gutterBottom variant="h5" component="div">
            {subfamily.name}
          </Typography>
          <Grid container spacing={1}>
            {datasheets.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                No datasheet available
              </Typography>
            ) : (
              datasheets.map((doc) => (
                <DocPanelDocAvatar key={doc.id} document={doc} />
              ))
            )}
          </Grid>
        </CardContent>
      </Card>
    </Grid>
  );
}

export default DocPanelSubfamily;
