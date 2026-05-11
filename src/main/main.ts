import { app, ipcMain, session, BrowserWindow, Menu, Notification } from 'electron'
const path = require('path');


/*debug*/
// `electron-is-dev` was unreliable in packaged builds (sometimes reporting
// dev mode in the installed app), which kept the auto-updater from running.
// `app.isPackaged` is part of Electron itself and is true iff the app is
// running from an installer / packaged bundle.
const isDev = !app.isPackaged
import {  installExtension,  REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS} from "electron-devtools-installer"


/*update */
import { autoUpdater, UpdateInfo, ProgressInfo } from "electron-updater"

/*ipc */
import ipcHandlers from './ipcHandlers'

const electronDl = require('electron-dl');
// const storeHandling = require('./utilities/storeHandling.js');

/*import store */

import {store} from './store/mainStore'

electronDl();
let win: BrowserWindow | null;

async function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload/preload.js'),
    },
    autoHideMenuBar: true // not show menu in window
    // autoHideMenuBar: false // show menu in window
  });




  // /* menu to test ipcToRenderer */
  // const menu = Menu.buildFromTemplate([
  //   {
  //     label: app.name,
  //     submenu: [
  //       {
  //         click: () => win.webContents.send('receive-msg', 'Msg A'),
  //         label: 'Msg A',
  //       },
  //       {
  //         click: () => win.webContents.send('receive-msg', 'Msg B'),
  //         label: 'Mgg B',
  //       }
  //     ]
  //   }

  // ])

  // Menu.setApplicationMenu(menu)


  if (!isDev) {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
    // The renderer triggers the auto-update check via the
    // `autoUpdate:check` IPC once the UpdateOrchestrator is ready, so it
    // can sequence the modal dialogs (app update first, then database).
  }

  // Open the DevTools.
  if (isDev) {
    await win.loadFile('./build/renderer/index.html')
    // console.log("Open dev tools")
    win.webContents.openDevTools({ mode: "detach" });
    // win.webContents.once("dom-ready", async () => {
    //   console.log('Call installExtension')
    //   await installExtension([REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS], { loadExtensionOptions: {allowFileAccess: true}})
    //     .then((name) => console.log(`Added Extension:  ${name}`))
    //     .catch((err) => console.log("An error occurred: ", err))
    //     .finally(() => {
    //       win.webContents.openDevTools({ mode: "detach" });
    //     });

    // });

  };

}

// if (isDev) {
//   // electron reload
//   console.log('test ' + __dirname);
//   require('electron-reload')(path.join(__dirname, '..', '..'), {
//     electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron')
//   });

// };

app.on('ready',async () => {
  createWindow();
  ipcHandlers();
  if (isDev) {
    try { 
      // [REDUX_DEVTOOLS,REACT_DEVELOPER_TOOLS].map((extention)=>{
      //   installExtension(extention)
      //     .then((ext:Electron.Extension)=> console.log(`Added extention ${ext.name}`))
      //     .catch((err:any)=>console.log("An errro occured in extention adding: ",err))
      // })
      
      // win.webContents.openDevTools({ mode: "detach" });
      const extensions = await installExtension([REACT_DEVELOPER_TOOLS], {
      // const extensions = await installExtension([REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS], {
      // const extensions = await installExtension([{id:'lmhkpmbekcpmknklioeibfkpmmfibljd'}], {
        // forceDownload: true,
        loadExtensionOptions: {allowFileAccess: true},
      })
        
      console.log(`Added Extensions:  ${extensions.map(ext => ext.name).join(", ")}`)
      await require("node:timers/promises").setTimeout(1000);
      session.defaultSession.getAllExtensions().map((ext) => {
        console.log(`Loading Extension: ${ext.name}`);
        session.defaultSession.loadExtension(ext.path)
      });
    } catch (err) {
      console.error('An error occurred while loading extensions: ', err);
    }
  }


});


// ---------------------------------------------------------------------------
// Auto-update wiring
// All UI is React-side now. The autoUpdater events here just forward into
// the renderer (channel: 'autoUpdate:event'), and the UpdateOrchestrator
// component decides what dialog to show and when.
// ---------------------------------------------------------------------------

function sendAutoUpdate(payload: Record<string, unknown>): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send('autoUpdate:event', payload);
    }
  }
}

function summariseInfo(info: UpdateInfo): {
  version: string;
  releaseName: string | null;
  releaseNotes: string | null;
  releaseDate: string | null;
} {
  const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : null;
  return {
    version: info.version,
    releaseName: typeof info.releaseName === 'string' ? info.releaseName : null,
    releaseNotes: notes,
    releaseDate: info.releaseDate ?? null,
  };
}

autoUpdater.on('checking-for-update', () => {
  sendAutoUpdate({ kind: 'checking' });
});

autoUpdater.on('update-available', (info: UpdateInfo) => {
  sendAutoUpdate({ kind: 'available', info: summariseInfo(info) });
});

autoUpdater.on('download-progress', (progress: ProgressInfo) => {
  sendAutoUpdate({
    kind: 'progress',
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total,
  });
});

autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
  sendAutoUpdate({ kind: 'downloaded', info: summariseInfo(info) });
});

autoUpdater.on('update-not-available', (info: UpdateInfo) => {
  sendAutoUpdate({ kind: 'not-available', info: summariseInfo(info) });
});

autoUpdater.on('error', (error: Error) => {
  console.error('autoUpdater error:', error);
  sendAutoUpdate({ kind: 'error', message: error?.message ?? String(error) });
});

// Renderer-driven control of the updater (the orchestrator triggers the
// check after it has mounted, and asks to install when the user agrees).
ipcMain.handle('autoUpdate:isEnabled', () => ({ enabled: !isDev }));

ipcMain.handle('autoUpdate:check', () => {
  if (isDev) {
    // Tell the renderer immediately that there's nothing to check so it
    // moves on to the database-update step without a timeout.
    sendAutoUpdate({ kind: 'disabled' });
    return { ok: true as const, started: false as const };
  }
  try {
    autoUpdater.checkForUpdates();
    return { ok: true as const, started: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendAutoUpdate({ kind: 'error', message });
    return { ok: false as const, message };
  }
});

ipcMain.handle('autoUpdate:quitAndInstall', () => {
  try {
    autoUpdater.quitAndInstall();
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, message };
  }
});

// Silence the linter — `Notification` is still imported for future use
// but we no longer fire the "no update" notification (the React orchestrator
// just hides itself silently when no update is found).
void Notification;
void Menu;

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
});

/*store test */
const render = () => {
  // if (win) {
  //     const { testSlice } = store.getState()
  //     console.log('store change: ');
  //     console.log(testSlice);
  // }
}

store.subscribe(render);

console.log('store subscrabe')

