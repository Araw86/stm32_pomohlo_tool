import React from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

function DocPanelSearch({ value, onChange }: Props): JSX.Element {
  return (
    <TextField
      size="small"
      fullWidth
      variant="outlined"
      placeholder="Filter by device (e.g. STM32U575RE) or document (e.g. DS13086)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => onChange('')} edge="end">
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
    />
  );
}

export default DocPanelSearch;
