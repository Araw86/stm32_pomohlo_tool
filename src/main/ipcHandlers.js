const { app, ipcMain, dialog } = require('electron');

const configurationfile = require('./utilities/configurationfile');
const filedownload = require('./utilities/filedownload');
const handlefiles = require('./utilities/handleFiles');
const handlesql = require('./utilities/handlesql');
const storeHandling = require('./utilities/storeHandling');
const docDetailsCheck = require('./utilities/docDetailsCheck');



function ipcHandlers() {
  /*data send from rendered will be returned to main */
  ipcMain.handle('config', (event, data) => {
    switch (data.type) {
      /*get version */
      case 0:
        return app.getVersion();
      /*load configuration */
      case 1:
        const oConfiguration = configurationfile.loadConfiguration();
        return { sStatus: 'ok', oConfiguration: oConfiguration }
      // return { sStatus: 'nok' }
      /*store configuration */
      case 2:
        configurationfile.storeConfiguration(data.data);
        return { sStatus: 'ok' }
      /*path exuists */
      case 3:
        return handlefiles.pathExists(data.data)
      /*load file */
      case 4:
        return handlefiles.loadFile(data.data);

      case 5:
        return handlefiles.runFile(data.data);

      case 6:
        return handlesql.runsql(data.data);
      default:
        return null;
    }
  });

  ipcMain.handle('docFiles', (event, data) => {
    switch (data.type) {
      case 0:
        return docDetailsCheck.checkFileStatDate(data.data)
      case 1:
        return docDetailsCheck.checkPdfMetaDate(data.data)
      default:
        return null;
    }
  })

  ipcMain.handle('stores', (event, data) => {
    switch (data.type) {
      case 0:
        return storeHandling.addStore(data.data)
      case 1:
        return storeHandling.storeSet(data.data)
      case 2:
        return storeHandling.storeGet(data.data)
      case 3:
        return storeHandling.eraseStore(data.data)
      default:
        return null;
    }
  })

  /*data send from rendered to main */
  ipcMain.on('write-message', (event, data) => {
    const webContents = event.sender
    //console.log(event);
    const dialogOpts = {
      type: 'info',
      buttons: ['Ok'],
      title: 'button pressed',
      message: 'button pressed',
      detail: 'button was pressed in rendered message: ' + data
    }
    dialog.showMessageBox(dialogOpts, (response) => {

    });
  });
  /*data send from rendered to main */
  ipcMain.on('download-doc-start', async (event, data) => {
    const { type, name, address, location } = data
    filedownload.manageDownload(type, name, address, location)
  });



};

module.exports = { ipcHandlers };


