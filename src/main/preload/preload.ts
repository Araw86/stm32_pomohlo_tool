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
  pickRepoPath: () => ipcRenderer.invoke('config:pickRepoPath'),
  openOrDownload: (
    docId: string,
    url: string,
    meta?: { version?: string; lastUpdate?: string },
  ) => ipcRenderer.invoke('doc:openOrDownload', { docId, url, meta }),
  startDownloads: (mode: 'all' | 'missing' | 'new') =>
    ipcRenderer.invoke('downloads:start', { mode }),
  cancelDownloads: () => ipcRenderer.invoke('downloads:cancel'),
  onDownloadProgress: (cb: (data: any) => void) => {
    const listener = (_event: unknown, data: any) => cb(data);
    ipcRenderer.on('downloads:progress', listener);
    return () => {
      ipcRenderer.removeListener('downloads:progress', listener);
    };
  },
});