import React from 'react';

import { Provider } from 'react-redux';
import { store } from './store/storeRenderer';

/* redux */

/*theming */
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

/*fonts*/
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import AppWindows from './components/AppWindows';
import UpdateOrchestrator from './components/UpdateOrchestrator/UpdateOrchestrator';

const darkTheme = createTheme({
  palette: {
    primary: {
      main: '#5893df',
    },
    secondary: {
      main: '#2ec5d3',
    },
    background: {
      default: '#192231',
      paper: '#24344d',
    },
    mode: 'dark',
  },
});

export default function App(): JSX.Element {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Provider store={store}>
        <AppWindows />
        {/* Runs the auto-update -> database-update sequence with React
            modal dialogs (replaces the old native dialogs). Mounted once
            here so the dialogs sit on top of any tab. */}
        <UpdateOrchestrator />
      </Provider>
    </ThemeProvider>
  );
}
