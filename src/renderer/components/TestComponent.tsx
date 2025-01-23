import React from 'react';
import { Box } from '@mui/system';
import { TypedUseSelectorHook, useSelector } from 'react-redux';
// import type { AppDispatch, RootState } from '../store/storeRenderer';
//TypedUseSelectorHook<RootState>
function TestComponent() {
  const testStateValue: number = useSelector((state) => {
    console.log(state);
    return 0;
  });
  const versionNode = window.versions?.chrome(); //
  console.log(window);
  return (
    <Box>
      <Box>TestComponent {testStateValue}</Box>
      <Box>node {versionNode}</Box>
    </Box>
  );
}

export default TestComponent;
