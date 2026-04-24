import { contextBridge, ipcRenderer } from 'electron'

import 'electron-redux/preload';
import {preload} from 'electron-redux/preload';

// call prelod to be able use electron-redux
preload();
console.log('preload run');
// declare the window.electronAPI, nor the font-end can't access electronAPI
declare global {
  interface Window {
    myAPI: any;
    versions:any;
    ipc_handlers:any;
  }
}

contextBridge.exposeInMainWorld('myAPI', {
  desktop: true,
});

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // we can also expose variables, not just functions
});

contextBridge.exposeInMainWorld('ipc_handlers', {
  loadDatabase: () => ipcRenderer.invoke('database:load'),
});