/**
 * Backend-1 bootstrap: logger, window, IPC, hotkeys, brain warm-up stub.
 */
const { app } = require('electron');
const logger = require('./logger');
const config = require('./config');
const brain = require('./brain');
const windowMod = require('./window');
const hotkey = require('./hotkey');
const {
  registerIpc,
  runCaptureSelectionPhase,
  scoreCapturedText,
} = require('./ipc');

/**
 * Deliver renderer payload once webContents can receive IPC, then reveal the hover window.
 * Returns a Promise that settles after the first IPC send is scheduled (after load if needed).
 * @param {{ activate?: boolean }} [opts] activate:false → showInactive (keep host app focused during capture).
 */
function presentWhenReady(win, envelope, opts = {}) {
  const activate = opts.activate !== false;
  return new Promise((resolve) => {
    const send = () => {
      if (!win.isDestroyed()) {
        win.webContents.send('shrink:presentation', envelope);
        if (activate) {
          windowMod.showWindow();
        } else {
          windowMod.showWindowInactive();
        }
      }
      resolve();
    };

    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', send);
    } else {
      send();
    }
  });
}

async function onShrinkHotkey(forced) {
  let win = windowMod.getWindow();
  if (!win || win.isDestroyed()) {
    windowMod.createWindow();
    win = windowMod.getWindow();
  }
  if (!win || win.isDestroyed()) return;

  /**
   * 1) Pop the hover shell immediately (inactive — host app stays focused for UIA / Ctrl+C).
   * 2) Capture selection, then focus the widget and show text while scoring.
   */
  await presentWhenReady(
    win,
    {
      type: 'capture',
      payload: { loading: true, phase: 'selection' },
    },
    { activate: false },
  );

  let partial;
  try {
    partial = await runCaptureSelectionPhase({ forced });
  } catch (e) {
    logger.error('runCaptureSelectionPhase failed', { message: e.message });
    await presentWhenReady(win, {
      type: 'capture',
      payload: {
        loading: false,
        capturedText: '',
        sourceApp: 'error',
        score: brain.fallbackScore(),
        error: e.message,
      },
    });
    return;
  }

  if (!partial.openWidget) {
    windowMod.hideWindow();
    return;
  }

  if (!win.isDestroyed()) {
    windowMod.showWindow();
    win.webContents.send('shrink:presentation', {
      type: 'capture',
      payload: {
        loading: true,
        phase: 'score',
        capturedText: partial.capturedText,
        sourceApp: partial.sourceApp,
      },
    });
  }

  const scoreResult = await scoreCapturedText(partial.capturedText);

  if (!win.isDestroyed()) {
    win.webContents.send('shrink:presentation', {
      type: 'capture',
      payload: {
        loading: false,
        capturedText: partial.capturedText,
        sourceApp: partial.sourceApp,
        score: scoreResult,
      },
    });
  }
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
