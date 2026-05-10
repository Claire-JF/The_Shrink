/**
 * Electron entry — delegates to Backend-1 (plumbing).
 */
require('dotenv').config();

const { app } = require('electron');
const { initBackend1, disposeBackend1 } = require('./backend1');

const verifyMode = process.env.VERIFY_BACKEND1 === '1';

// Single instance: globalShortcut only one owner
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = require('./backend1/window').getWindow();
    if (win) {
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    await initBackend1();
    if (verifyMode) {
      setTimeout(() => app.quit(0), 600);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    disposeBackend1();
  });
}
