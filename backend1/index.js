/**
 * Backend-1 bootstrap: logger, window, IPC, hotkeys, brain warm-up stub.
 */
const { app } = require('electron');
const logger = require('./logger');
const config = require('./config');
const brain = require('./brain');
const windowMod = require('./window');
const hotkey = require('./hotkey');
const { registerIpc, runCaptureFlow } = require('./ipc');

/**
 * Deliver renderer payload once webContents can receive IPC, then reveal the hover window.
 */
function presentWhenReady(win, envelope) {
  const send = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('shrink:presentation', envelope);
      windowMod.showWindow();
    }
  };

  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

async function onShrinkHotkey(forced) {
  let win = windowMod.getWindow();
  if (!win || win.isDestroyed()) {
    windowMod.createWindow();
    win = windowMod.getWindow();
  }
  if (!win || win.isDestroyed()) return;

  // Open immediately — most perceived delay is networking to score(); don't block UI until then.
  presentWhenReady(win, { type: 'loading', payload: {} });

  let result;
  try {
    result = await runCaptureFlow({ forced });
  } catch (e) {
    logger.error('runCaptureFlow failed', { message: e.message });
    result = {
      capturedText: '',
      sourceApp: 'error',
      score: brain.fallbackScore(),
      openWidget: true,
      error: e.message,
    };
  }

  if (!result.openWidget) {
    windowMod.hideWindow();
    return;
  }

  presentWhenReady(win, { type: 'capture', payload: result });
}

async function initBackend1() {
  logger.init(app);
  await brain.initBrain().catch((e) => logger.warn('Backend-2 init failed', { message: e.message }));

  registerIpc();
  hotkey.register({
    onShrinkTrigger: () => onShrinkHotkey(false),
    onForcedTrigger: () => onShrinkHotkey(true),
    onDemoToggle: () => {
      const on = config.toggleDemoMode();
      logger.info('demo mode toggled', { demoMode: on });
      const win = windowMod.getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('shrink:presentation', {
          type: 'config',
          payload: { demoMode: on },
        });
      }
    },
  });

  logger.info('Backend-1 initialized', {
    demoMode: config.get('demoMode'),
    mockSelection: config.get('mockSelection'),
  });
}

function disposeBackend1() {
  hotkey.unregister();
  windowMod.destroyWindow();
}

module.exports = {
  initBackend1,
  disposeBackend1,
};
