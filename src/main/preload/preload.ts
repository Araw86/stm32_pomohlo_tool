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
  setVersionCheckOnOpen: (enabled: boolean) =>
    ipcRenderer.invoke('config:setVersionCheckOnOpen', { enabled }),
  setCheckDatabaseOnStartup: (enabled: boolean) =>
    ipcRenderer.invoke('config:setCheckDatabaseOnStartup', { enabled }),
  openOrDownload: (
    docId: string,
    url: string,
    meta?: { version?: string; lastUpdate?: string; pdfCreated?: string },
  ) => ipcRenderer.invoke('doc:openOrDownload', { docId, url, meta }),
  startDownloads: (mode: 'all' | 'missing' | 'new') =>
    ipcRenderer.invoke('downloads:start', { mode }),
  previewDownloads: () => ipcRenderer.invoke('downloads:preview'),
  cancelDownloads: () => ipcRenderer.invoke('downloads:cancel'),
  onDownloadProgress: (cb: (data: any) => void) => {
    const listener = (_event: unknown, data: any) => cb(data);
    ipcRenderer.on('downloads:progress', listener);
    return () => {
      ipcRenderer.removeListener('downloads:progress', listener);
    };
  },
  listDatabaseSources: () => ipcRenderer.invoke('databaseSource:list'),
  checkLatestDatabase: (sourceId: string) =>
    ipcRenderer.invoke('databaseSource:checkLatest', { sourceId }),
  downloadDatabaseSource: (sourceId: string) =>
    ipcRenderer.invoke('databaseSource:download', { sourceId }),
  onDatabaseSourceProgress: (cb: (data: any) => void) => {
    const listener = (_event: unknown, data: any) => cb(data);
    ipcRenderer.on('databaseSource:progress', listener);
    return () => {
      ipcRenderer.removeListener('databaseSource:progress', listener);
    };
  },
  // ---------- File dialogs (used by Custom family) ----------
  pickPdfFile: () => ipcRenderer.invoke('dialog:pickPdf'),
  pickZipFile: () => ipcRenderer.invoke('dialog:pickZip'),
  saveZipFile: (defaultName: string) =>
    ipcRenderer.invoke('dialog:saveZip', { defaultName }),
  // ---------- Custom families ----------
  listCustomFamilies: () => ipcRenderer.invoke('customFamily:list'),
  loadCustomFamily: (id: string) =>
    ipcRenderer.invoke('customFamily:load', { id }),
  createCustomFamily: (name: string) =>
    ipcRenderer.invoke('customFamily:create', { name }),
  renameCustomFamily: (id: string, newName: string) =>
    ipcRenderer.invoke('customFamily:rename', { id, newName }),
  deleteCustomFamily: (id: string, deletePdfs: boolean) =>
    ipcRenderer.invoke('customFamily:delete', { id, deletePdfs }),
  addCustomSubfamily: (familyId: string, name: string) =>
    ipcRenderer.invoke('customFamily:addSubfamily', { familyId, name }),
  renameCustomSubfamily: (familyId: string, subfamilyId: string, name: string) =>
    ipcRenderer.invoke('customFamily:renameSubfamily', {
      familyId,
      subfamilyId,
      name,
    }),
  deleteCustomSubfamily: (
    familyId: string,
    subfamilyId: string,
    deletePdfs: boolean,
  ) =>
    ipcRenderer.invoke('customFamily:deleteSubfamily', {
      familyId,
      subfamilyId,
      deletePdfs,
    }),
  addCustomDevice: (familyId: string, subfamilyId: string, name: string) =>
    ipcRenderer.invoke('customFamily:addDevice', {
      familyId,
      subfamilyId,
      name,
    }),
  renameCustomDevice: (familyId: string, deviceId: string, name: string) =>
    ipcRenderer.invoke('customFamily:renameDevice', {
      familyId,
      deviceId,
      name,
    }),
  deleteCustomDevice: (
    familyId: string,
    deviceId: string,
    deletePdfs: boolean,
  ) =>
    ipcRenderer.invoke('customFamily:deleteDevice', {
      familyId,
      deviceId,
      deletePdfs,
    }),
  addCustomDocument: (input: {
    familyId: string;
    subfamilyId: string;
    deviceId: string;
    sourcePath: string;
    docId: string;
    type: string;
    title: string;
    version?: string;
  }) => ipcRenderer.invoke('customFamily:addDocument', input),
  renameCustomDocument: (input: {
    familyId: string;
    docId: string;
    title?: string;
    type?: string;
    version?: string;
  }) => ipcRenderer.invoke('customFamily:renameDocument', input),
  deleteCustomDocument: (
    familyId: string,
    docId: string,
    deletePdf: boolean,
  ) =>
    ipcRenderer.invoke('customFamily:deleteDocument', {
      familyId,
      docId,
      deletePdf,
    }),
  exportCustomFamily: (id: string, savePath: string) =>
    ipcRenderer.invoke('customFamily:export', { id, savePath }),
  importCustomFamily: (zipPath: string, renameTo?: string) =>
    ipcRenderer.invoke('customFamily:import', { zipPath, renameTo }),
});