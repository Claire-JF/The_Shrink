/**
 * Global shortcuts — CommandOrControl works: Ctrl on Windows, Cmd on macOS.
 */
const { globalShortcut } = require('electron');
const logger = require('./logger');

let registered = false;

/** Last successfully registered accelerator per role (null = none worked). */
const lastRegistered = {
  shrink: null,
  forced: null,
  demoToggle: null,
};

function wrapHandler(acc, fn) {
  return () => {
    try {
      const r = fn();
      if (r && typeof r.then === 'function') {
        r.catch((e) => logger.error('hotkey handler failed', { acc, message: e.message }));
      }
    } catch (e) {
      logger.error('hotkey handler threw', { acc, message: e.message });
    }
  };
}

function registerFirstWorking(label, accelerators, fn) {
  for (const acc of accelerators) {
    const ok = globalShortcut.register(acc, wrapHandler(acc, fn));
    if (ok) {
      logger.info('registered shortcut', { acc, role: label });
      return acc;
    }
    logger.warn('shortcut registration failed — accelerator busy or unsupported', {
      acc,
      role: label,
      platform: process.platform,
    });
  }
  logger.error('failed to register shortcut (exhausted fallbacks)', { role: label, accelerators });
  return null;
}

/**
 * @param {object} handlers
 * @param {() => void | Promise<void>} handlers.onShrinkTrigger  Cmd/Ctrl+R
 * @param {() => void | Promise<void>} handlers.onForcedTrigger   Cmd/Ctrl+Shift+S (fallbacks on Windows if busy)
 * @param {() => void | Promise<void>} handlers.onDemoToggle      Cmd/Ctrl+Shift+D
 */
function register(handlers) {
  if (registered) return;

  // Ctrl+R / Cmd+R is often taken by GPU overlays, IME, terminals (reverse search), IDEs, etc.
  const shrinkChain = [
    'CommandOrControl+R',
    'Control+Alt+R',
    'CommandOrControl+Shift+R',
  ];
  lastRegistered.shrink = registerFirstWorking('shrink', shrinkChain, handlers.onShrinkTrigger);

  const forcedChain =
    process.platform === 'win32'
      ? [
          'CommandOrControl+Shift+S',
          'CommandOrControl+Shift+Y',
          'CommandOrControl+Alt+Shift+S',
        ]
      : ['CommandOrControl+Shift+S', 'CommandOrControl+Alt+S'];
  lastRegistered.forced = registerFirstWorking('forced', forcedChain, handlers.onForcedTrigger);

  lastRegistered.demoToggle = registerFirstWorking(
    'demo-toggle',
    ['CommandOrControl+Shift+D'],
    handlers.onDemoToggle,
  );

  registered = true;
}

function getRegisteredAccelerators() {
  return { ...lastRegistered };
}

function unregister() {
  if (!registered) return;
  globalShortcut.unregisterAll();
  registered = false;
  lastRegistered.shrink = null;
  lastRegistered.forced = null;
  lastRegistered.demoToggle = null;
  logger.info('unregistered all shortcuts');
}

module.exports = {
  register,
  unregister,
  getRegisteredAccelerators,
};
