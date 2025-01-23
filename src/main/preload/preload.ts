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
  ipcTwoWay: (data:any) => {
    return ipcRenderer.invoke('config', data);
  },
  ipcToMain: (text:String) => ipcRenderer.send('write-message', text),
  // we can also expose variables, not just functions
  ipcToRenderer: (callback:any) => ipcRenderer.on('receive-msg', callback),

  ipcToMainTest: (url:String) => ipcRenderer.send('download-button', url),

  ipcToMainDownload: (oInfo:any) => ipcRenderer.send('download-doc-start', oInfo),
  ipcToRendererDownload: (callback:any) => {
    /* remove all listeners to be sure only one is active */
    ipcRenderer.removeAllListeners('download-doc-response')
    ipcRenderer.on('download-doc-response', callback)
  },
  ipcToStores: (data:any) => {
    return ipcRenderer.invoke('stores', data)
  },
  ipcToDocFiles: (data:any) => {
    return ipcRenderer.invoke('docFiles', data)
  }
});