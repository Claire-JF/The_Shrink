/**
 * Global shortcuts — CommandOrControl works: Ctrl on Windows, Cmd on macOS.
 */
const { globalShortcut } = require('electron');
const logger = require('./logger');

let registered = false;

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
    if (globalShortcut.register(acc, wrapHandler(acc, fn))) {
      logger.info('registered shortcut', { acc, role: label });
      return acc;
    }
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

  // Ctrl+R / Cmd+R is often taken by GPU overlays, IME, VMs, IDE globals, etc. Try fallbacks on Windows.
  const shrinkChain =
    process.platform === 'win32'
      ? ['CommandOrControl+R', 'Control+Alt+R', 'CommandOrControl+Shift+R']
      : ['CommandOrControl+R'];
  registerFirstWorking('shrink', shrinkChain, handlers.onShrinkTrigger);

  const forcedChain =
    process.platform === 'win32'
      ? [
          'CommandOrControl+Shift+S',
          'CommandOrControl+Shift+Y',
          'CommandOrControl+Alt+Shift+S',
        ]
      : ['CommandOrControl+Shift+S'];
  registerFirstWorking('forced', forcedChain, handlers.onForcedTrigger);

  registerFirstWorking('demo-toggle', ['CommandOrControl+Shift+D'], handlers.onDemoToggle);

  registered = true;
}

function unregister() {
  if (!registered) return;
  globalShortcut.unregisterAll();
  registered = false;
  logger.info('unregistered all shortcuts');
}

module.exports = {
  register,
  unregister,
};
