const { app, session, dialog, BrowserWindow, Menu, Notification } = require('electron');
const path = require('path');

/*debug*/
const isDev = require('electron-is-dev')
const {
  default: installExtension,
  REDUX_DEVTOOLS,
  REACT_DEVELOPER_TOOLS
} = require("electron-devtools-installer");


/*update */
const { autoUpdater } = require("electron-updater")

/*ipc */
const ipc = require('./ipcHandlers.js');

const electronDl = require('electron-dl');
const storeHandling = require('./utilities/storeHandling.js');

electronDl();

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      enableRemoteModule: true,
      autoHideMenuBar: true,
      preload: path.join(__dirname, 'preload/preload.js'),
    }
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

if (isDev) {
  // electron reload
  console.log('test ' + __dirname);
  require('electron-reload')(path.join(__dirname, '..', '..'), {
    electron: path.join(__dirname, '..', '..', 'node_modules', '.bin', 'electron')
  });

};

app.on('ready', () => {
  createWindow();
  ipc.ipcHandlers();

});




autoUpdater.on("update-available", (_event, releaseNotes, releaseName) => {
  console.log(_event);
  console.log(releaseNotes);
  console.log(releaseName);
  const dialogOpts = {
    type: 'info',
    buttons: ['Ok'],
    title: 'Application Update',
    message: process.platform === 'win32' ? releaseNotes : releaseName,
    detail: 'A new version is being downloaded.'
  }
  dialog.showMessageBox(dialogOpts, (response) => {

  });
})

autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Application Update',
    message: process.platform === 'win32' ? releaseNotes : releaseName,
    detail: 'A new version has been downloaded. Restart the application to apply the updates.'
  };
  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall()
  })
});


autoUpdater.on("update-not-available", (_event, releaseNotes, releaseName) => {
  console.log(_event);
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

  const NOTIFICATION_TITLE = 'Application No Update'
  const NOTIFICATION_BODY = 'No new version found'
  showNotification();
  function showNotification() {
    new Notification({ title: NOTIFICATION_TITLE, body: NOTIFICATION_BODY }).show()
  }
}
);

autoUpdater.on("error", (_event) => {
  console.log(_event);
  const dialogOpts = {
    type: 'info',
    buttons: ['Ok'],
    title: 'Error',
    message: '',
    detail: 'No version found.' + _event
  }
  dialog.showMessageBox(dialogOpts, (response) => {
  });
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