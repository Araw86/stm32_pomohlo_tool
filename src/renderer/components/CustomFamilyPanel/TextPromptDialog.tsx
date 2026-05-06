import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

/** Tiny single-input dialog reused by every "name / rename" flow on the
 * Custom family tab. Pre-fills `defaultValue` whenever the dialog opens
 * so reopening with new context (e.g. a different subfamily) shows that
 * context's value. */
export function TextPromptDialog(props: {
  open: boolean;
  title: string;
  label: string;
  helperText?: string;
  defaultValue?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}): JSX.Element {
  const [value, setValue] = useState(props.defaultValue ?? '');

  useEffect(() => {
    if (props.open) setValue(props.defaultValue ?? '');
  }, [props.open, props.defaultValue]);

  const submit = () => {
    if (!value.trim()) return;
    props.onConfirm(value.trim());
  };

  return (
    <Dialog open={props.open} onClose={props.onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label={props.label}
          helperText={props.helperText}
          fullWidth
          size="small"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onCancel}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!value.trim()}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
