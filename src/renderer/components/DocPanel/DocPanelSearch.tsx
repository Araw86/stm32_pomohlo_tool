import React, { useRef } from 'react';
import { Button, InputAdornment, Stack, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

function DocPanelSearch({ value, onChange }: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    // Re-focus the input so the user can keep typing immediately.
    inputRef.current?.focus();
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        size="small"
        fullWidth
        variant="outlined"
        placeholder="Filter by device (e.g. STM32U575RE) or document (e.g. DS13086)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputRef={inputRef}
        sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<ClearIcon />}
        onClick={handleClear}
        disabled={value.length === 0}
        sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
      >
        Clear
      </Button>
    </Stack>
  );
}

export default DocPanelSearch;
