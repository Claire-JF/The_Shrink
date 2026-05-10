/**
 * Dual mock UI placeholders: bottom input chip + top-right translucent orb (360-style).
 */
const path = require('path');
const { BrowserWindow, screen } = require('electron');

let inputBarWin = null;
let orbWin = null;

function getInputBarWindow() {
  return inputBarWin;
}

function getOrbWindow() {
  return orbWin;
}

function layoutBounds(inputHeight = 210) {
  const disp = screen.getPrimaryDisplay();
  const wa = disp.workArea || disp.bounds;
  const barW = Math.min(620, wa.width - 48);
  const barH = inputHeight;
  const barY = wa.y + wa.height - barH - 28;
  const barX = wa.x + Math.floor((wa.width - barW) / 2);

  const orbSize = 120;
  const orbX = wa.x + wa.width - orbSize - 14;
  const orbY = wa.y + 12;

  return { wa, barW, barH, barX, barY, orbSize, orbX, orbY };
}

function broadcastOrb(payload) {
  const data = typeof payload === 'object' ? payload : {};
  if (orbWin && !orbWin.isDestroyed()) {
    orbWin.webContents.send('mock-ui:orbit', data);
  }
}

function dismissMockUi() {
  if (inputBarWin && !inputBarWin.isDestroyed()) {
    inputBarWin.hide();
  }
  if (orbWin && !orbWin.isDestroyed()) {
    orbWin.hide();
  }
}

function showMockUiPair() {
  const preloadPath = path.join(__dirname, '..', 'preload.js');

  const { barW, barH, barX, barY, orbSize, orbX, orbY } = layoutBounds(210);

  if (!orbWin || orbWin.isDestroyed()) {
    orbWin = new BrowserWindow({
      width: orbSize,
      height: orbSize,
      x: orbX,
      y: orbY,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: true,
      movable: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    orbWin.loadFile(path.join(__dirname, '..', 'renderer', 'mock-orb.html'));
    orbWin.on('closed', () => {
      orbWin = null;
    });
  } else {
    orbWin.setBounds({ x: orbX, y: orbY, width: orbSize, height: orbSize }, true);
  }

  if (!inputBarWin || inputBarWin.isDestroyed()) {
    inputBarWin = new BrowserWindow({
      width: barW,
      height: barH,
      x: barX,
      y: barY,
      frame: false,
      transparent: false,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
      titleBarOverlay: undefined,
      roundedCorners: true,
      thickFrame: false,
    });

    /** @see https://www.electronjs.org/docs/latest/api/browser-window#page-visibility Window vibrancy omitted for Windows portability */
    inputBarWin.loadFile(path.join(__dirname, '..', 'renderer', 'mock-input-bar.html'));
    inputBarWin.on('closed', () => {
      inputBarWin = null;
    });
    inputBarWin.setBackgroundColor('#cc11141c');
    inputBarWin.setOpacity(1);
  } else {
    inputBarWin.setBounds({ x: barX, y: barY, width: barW, height: barH }, true);
  }

  orbWin.show();
  inputBarWin.show();
  inputBarWin.focus();
}

function toggleOrFocusMockUi() {
  showMockUiPair();
}

function resizeInputBar(heightPx) {
  const clamped = Math.max(118, Math.min(440, Number(heightPx) || 138));
  if (!inputBarWin || inputBarWin.isDestroyed()) return;
  const b = layoutBounds(clamped);
  inputBarWin.setBounds(
    {
      x: Math.round(b.barX),
      y: Math.round(b.barY),
      width: Math.round(b.barW),
      height: Math.round(b.barH),
    },
    false
  );
}

function destroyMockShell() {
  if (orbWin && !orbWin.isDestroyed()) {
    orbWin.destroy();
  }
  if (inputBarWin && !inputBarWin.isDestroyed()) {
    inputBarWin.destroy();
  }
  orbWin = null;
  inputBarWin = null;
}

module.exports = {
  showMockUiPair,
  toggleOrFocusMockUi,
  dismissMockUi,
  destroyMockShell,
  broadcastOrb,
  getOrbWindow,
  getInputBarWindow,
  layoutBounds,
  resizeInputBar,
};
