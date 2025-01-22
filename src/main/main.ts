import { app, session, dialog, BrowserWindow, Menu, Notification, MessageBoxOptions } from 'electron'
const path = require('path');


/*debug*/
const isDev = require('electron-is-dev')
const {
  default: installExtension,
  REDUX_DEVTOOLS,
  REACT_DEVELOPER_TOOLS
} = require("electron-devtools-installer");


/*update */
import { autoUpdater, UpdateInfo } from "electron-updater"

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
    autoHideMenuBar: true
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

  // Open the DevTools.
  if (isDev) {

    await win.loadFile('./build/renderer/index.html')
    win.webContents.openDevTools({ mode: "detach" });
    // win.webContents.once("dom-ready", async () => {
    //   await installExtension([REDUX_DEVTOOLS])
    //     .then((name) => console.log(`Added Extension:  ${name}`))
    //     .catch((err) => console.log("An error occurred: ", err))
    //     .finally(() => {
    //       win.webContents.openDevTools({ mode: "detach" });
    //     });

    // });

  };
  if (!isDev) {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
    autoUpdater.checkForUpdates();
  }

}

// if (isDev) {
//   // electron reload
//   console.log('test ' + __dirname);
//   require('electron-reload')(path.join(__dirname, '..', '..'), {
//     electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron')
//   });

// };

app.on('ready', () => {

  [REDUX_DEVTOOLS].map((extention)=>{
    installExtension(extention)
      .then((name:string)=> console.log(`Added extention ${name}`))
      .catch((err:any)=>console.log("An errro occured in extention adding: ",err))
  })
  createWindow();
  ipcHandlers();

});


function isText(data: unknown): data is string {
  return typeof data === 'string';
};

autoUpdater.on("update-available", (info: UpdateInfo) => {
  const {releaseNotes,releaseName} = info;
  console.log(releaseNotes);
  console.log(releaseName);
  if(isText(releaseNotes) && isText(releaseName)){
    const dialogOpts:MessageBoxOptions = {
      type: 'info',
      buttons: ['Ok'],
      title: 'Application Update',
      message: process.platform === 'win32' ? releaseNotes : releaseName,
      detail: 'A new version is being downloaded.'
    }
    dialog.showMessageBox(dialogOpts);
  }
})

autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
  const {releaseNotes,releaseName} = info;
  if(isText(releaseNotes) && isText(releaseName)){
    const dialogOpts:MessageBoxOptions = {
      type: 'info',
      buttons: ['Restart', 'Later'],
      title: 'Application Update',
      message: process.platform === 'win32' ? releaseNotes : releaseName,
      detail: 'A new version has been downloaded. Restart the application to apply the updates.'
    };
    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) autoUpdater.quitAndInstall()
    })
  }
});


autoUpdater.on("update-not-available", (info: UpdateInfo) => {
  const {releaseNotes,releaseName} = info;
  console.log(releaseNotes);
  console.log(releaseName);
  // const dialogOpts = {
  //   type: 'info',
  //   buttons: ['Ok'],
  //   title: 'Application No Update',
  //   message: process.platform === 'win32' ? releaseNotes : releaseName,
  //   detail: 'No version found.'
  // }
  // dialog.showMessageBox(dialogOpts, (response) => {

  // });

  const NOTIFICATION_TITLE :string= 'Application No Update'
  const NOTIFICATION_BODY :string = 'No new version found'
  showNotification();
  function showNotification() {
    const notificationContent : {title:string, body:string} = {title: NOTIFICATION_TITLE, body: NOTIFICATION_BODY };
    let notification :Notification = new Notification(notificationContent);
    notification.show();
  }
}
);

autoUpdater.on("error", (error:Error) => {
  console.log(error);
  const dialogOpts:Electron.MessageBoxOptions = {
    type: 'info',
    buttons: ['Ok'],
    title: 'Error',
    message: '',
    detail: 'No version found.' + error
  }
  dialog.showMessageBox(dialogOpts);
}
);

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
  if (win) {
      const { testSlice } = store.getState()
      console.log('store change: ');
      console.log(testSlice);
  }
}

store.subscribe(render);
console.log('store subscrabe')

