/**
 * System tray fallback when globalShortcut fails (common on Linux Wayland / desktop conflicts).
 */
const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

let tray = null;

function loadTrayIcon() {
  const iconPath = path.join(__dirname, '..', 'renderer', 'cats', 'cat_happy.png');
  try {
    if (!fs.existsSync(iconPath)) {
      logger.warn('tray: cat icon missing', { iconPath });
      return nativeImage.createEmpty();
    }
    let img = nativeImage.createFromPath(iconPath);
    if (img.isEmpty()) {
      return nativeImage.createEmpty();
    }
    const size = process.platform === 'darwin' ? 18 : 22;
    return img.resize({ width: size, height: size });
  } catch (e) {
    logger.warn('tray: icon load failed', { message: e.message });
    return nativeImage.createEmpty();
  }
}

/**
 * @param {object} handlers
 * @param {() => void | Promise<void>} handlers.onShrinkTrigger
 * @param {() => void | Promise<void>} handlers.onForcedTrigger
 * @param {() => void} handlers.onDemoToggle
 */
function initTray(handlers) {
  if (tray) return;

  try {
    const icon = loadTrayIcon();
    tray = new Tray(icon);
  } catch (e) {
    logger.error('tray: could not create system tray', {
      message: e.message,
      hint: 'Install libappindicator / ayatana on Linux for tray icons.',
    });
    return;
  }

  tray.setToolTip('The Shrink — use menu if keyboard shortcuts do not work');

  const run = (fn) => {
    try {
      const r = fn?.();
      if (r && typeof r.then === 'function') {
        r.catch((err) => logger.error('tray action failed', { message: err.message }));
      }
    } catch (err) {
      logger.error('tray action threw', { message: err.message });
    }
  };

  const menu = Menu.buildFromTemplate([
    {
      label: 'Shrink selection',
      click: () => run(handlers.onShrinkTrigger),
    },
    {
      label: 'Forced shrink',
      click: () => run(handlers.onForcedTrigger),
    },
    { type: 'separator' },
    {
      label: 'Toggle demo mode',
      click: () => run(handlers.onDemoToggle),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);

  /* Linux / Win: primary click triggers shrink (macOS usually opens menu only). */
  if (process.platform !== 'darwin') {
    tray.on('click', () => run(handlers.onShrinkTrigger));
  }

  logger.info('system tray ready — use tray if global shortcuts do not fire');
}

function destroyTray() {
  if (tray) {
    try {
      tray.destroy();
    } catch {
      /* ignore */
    }
    tray = null;
  }
}

module.exports = {
  initTray,
  destroyTray,
};
