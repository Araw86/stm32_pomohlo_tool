import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';

/** Confirmation dialog that optionally exposes a "delete the PDFs too?"
 * toggle. The delete-PDFs default is OFF so accidental clicks never trash
 * files in the shared repository. */
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  showKeepPdfsToggle?: boolean;
  /** Optional override for the "keep PDFs" switch label. */
  keepLabel?: string;
  /** Optional override for the "delete PDFs" switch label. */
  deleteLabel?: string;
  onCancel: () => void;
  onConfirm: (deletePdfs: boolean) => void;
}): JSX.Element {
  const [deletePdfs, setDeletePdfs] = useState(false);

  useEffect(() => {
    if (props.open) setDeletePdfs(false);
  }, [props.open]);

  return (
    <Dialog open={props.open} onClose={props.onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {props.message}
        </Typography>
        {props.showKeepPdfsToggle && (
          <FormControlLabel
            control={
              <Switch
                checked={deletePdfs}
                onChange={(_, checked) => setDeletePdfs(checked)}
                color="error"
              />
            }
            label={
              deletePdfs
                ? props.deleteLabel ?? 'Also delete the PDFs from the repository'
                : props.keepLabel ?? 'Keep the PDFs in the repository'
            }
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onCancel}>
          {props.cancelLabel ?? 'Cancel'}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => props.onConfirm(deletePdfs)}
        >
          {props.confirmLabel ?? 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
