/**
 * Floating widget window — opaque, always-on-top, frameless (Windows-first).
 */
const { BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow = null;

function getWindow() {
  return mainWindow;
}

function getCursorPointOrCenter() {
  const p = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(p);
  if (display && display.workArea) {
    return { x: p.x, y: p.y, workArea: display.workArea };
  }
  return { x: p.x, y: p.y, workArea: null };
}

function clampPosition(bounds, workArea) {
  if (!workArea) return bounds;
  const margin = 8;
  let { x, y, width, height } = bounds;
  const wa = workArea;
  if (x + width > wa.x + wa.width) x = wa.x + wa.width - width - margin;
  if (y + height > wa.y + wa.height) y = wa.y + wa.height - height - margin;
  if (x < wa.x + margin) x = wa.x + margin;
  if (y < wa.y + margin) y = wa.y + margin;
  return { x, y, width, height };
}

function createWindow() {
  const preload = path.join(__dirname, '..', 'preload.js');
  const indexHtml = path.join(__dirname, '..', 'renderer', 'index.html');

  const cursor = getCursorPointOrCenter();
  const width = 620;
  const height = 348;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: cursor.x - Math.floor(width / 2),
    y: cursor.y - 12,
    frame: false,
    show: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    // Opaque surface; no transparent: true (avoid focus/hit-test pain on desktop)
    backgroundColor: '#0f1115',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const b = mainWindow.getBounds();
  const adjusted = clampPosition(b, cursor.workArea);
  mainWindow.setBounds(adjusted);

  mainWindow.loadFile(indexHtml);
  // Visibility is controlled by Backend-1 after capture / IPC (avoid empty flash).

  // Same key as global shrink hotkey (Ctrl+R): block in-window reload so capture can repeat safely.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isR = input.key?.toLowerCase() === 'r';
    const mod = input.control || input.meta;
    if (input.type === 'keyDown' && mod && !input.alt && !input.shift && isR) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function hideWindow() {
  if (!mainWindow) return;
  mainWindow.hide();
}

function destroyWindow() {
  if (!mainWindow) return;
  mainWindow.destroy();
  mainWindow = null;
}

module.exports = {
  getWindow,
  createWindow,
  showWindow,
  hideWindow,
  destroyWindow,
};
