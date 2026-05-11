/**
 * Floating widget — frameless, always-on-top.
 * Linux defaults to an opaque dark canvas so the orb stays visible when GPU/compositors
 * break transparency (`SHRINK_GLASS=1` restores transparent window).
 */
const { BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow = null;

function getWindow() {
  return mainWindow;
}

/** Display containing the cursor — used to anchor the hover shell top-right. */
function getWorkAreaNearCursor() {
  const p = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(p);
  return display?.workArea ?? null;
}

/** Place window flush to the work-area top-right with a small margin (floating orb shell). */
function getTopRightBounds(width, height) {
  const wa = getWorkAreaNearCursor();
  if (!wa) {
    return { x: 0, y: 0, width, height, workArea: null };
  }
  const margin = 10;
  const x = wa.x + wa.width - width - margin;
  const y = wa.y + margin;
  return { x, y, width, height, workArea: wa };
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

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

/** Work area for the display that contains the center of this window. */
function getWorkAreaContaining(bounds) {
  const cx = bounds.x + Math.floor(bounds.width / 2);
  const cy = bounds.y + Math.floor(bounds.height / 2);
  const display = screen.getDisplayNearestPoint({ x: cx, y: cy });
  return display?.workArea ?? null;
}

/**
 * Resize the hover window to tightly wrap renderer content. By default keeps the
 * top-right corner fixed so the orb stays anchored while the panel opens downward.
 */
function syncOrbContentSize(contentWidth, contentHeight, options = {}) {
  const keepTopRight = options.keepTopRight !== false;
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;

  const pad = 16;
  /* Floor below cat-mode padded #shell (see renderer/styles.css body.mode-cat .shell). */
  const w = Math.max(640, Math.ceil(Number(contentWidth) + pad));
  const h = Math.max(740, Math.ceil(Number(contentHeight) + pad));

  const b = win.getBounds();
  let x;
  let y;
  if (keepTopRight && b.width > 0 && b.height > 0) {
    const right = b.x + b.width;
    const top = b.y;
    x = right - w;
    y = top;
  } else {
    const wa = getWorkAreaNearCursor();
    const margin = 10;
    if (wa) {
      x = wa.x + wa.width - w - margin;
      y = wa.y + margin;
    } else {
      x = b.x;
      y = b.y;
    }
  }

  let next = { x, y, width: w, height: h };
  const wa = getWorkAreaContaining(next);
  next = clampPosition(next, wa);
  win.setBounds(next, false);
}

function setWindowPosition(screenX, screenY) {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();
  const wa = getWorkAreaContaining(b);
  let nx = Math.round(Number(screenX));
  let ny = Math.round(Number(screenY));
  if (wa) {
    const margin = 8;
    nx = clamp(nx, wa.x + margin, wa.x + wa.width - b.width - margin);
    ny = clamp(ny, wa.y + margin, wa.y + wa.height - b.height - margin);
  }
  win.setPosition(nx, ny);
}

function getWindowBounds() {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return null;
  return win.getBounds();
}

function useTransparentBrowserWindow() {
  if (process.env.SHRINK_GLASS === '1') return true;
  if (process.env.SHRINK_OPAQUE === '1') return false;
  /* Linux: transparent windows often render fully invisible with GPU/compositor issues. */
  if (process.platform === 'linux') return false;
  return true;
}

function createWindow() {
  const preload = path.join(__dirname, '..', 'preload.js');
  const indexHtml = path.join(__dirname, '..', 'renderer', 'index.html');

  const transparent = useTransparentBrowserWindow();

  const width = 700;
  const height = 820;
  const initial = getTopRightBounds(width, height);

  mainWindow = new BrowserWindow({
    width: initial.width,
    height: initial.height,
    x: initial.x,
    y: initial.y,
    frame: false,
    show: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    transparent,
    hasShadow: true,
    backgroundColor: transparent ? '#00000000' : '#141824',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Stronger stay-above on macOS (still respects fullscreen spaces behavior).
  if (process.platform === 'darwin') {
    mainWindow.setAlwaysOnTop(true, 'floating');
  }

  try {
    if (typeof mainWindow.setVisibleOnAllWorkspaces === 'function') {
      mainWindow.setVisibleOnAllWorkspaces(true);
    }
  } catch {
    /* optional API */
  }

  const b = mainWindow.getBounds();
  const adjusted = clampPosition(b, initial.workArea);
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
  if (typeof mainWindow.setOpacity === 'function') {
    mainWindow.setOpacity(1);
  }
  mainWindow.show();
  mainWindow.focus();
  if (typeof mainWindow.moveTop === 'function') {
    mainWindow.moveTop();
  }
}

/**
 * Show without activating — keeps the previous app foreground for UI Automation / Ctrl+C
 * while the hover shell is already visible (Windows + macOS).
 */
function showWindowInactive() {
  if (!mainWindow) return;
  if (typeof mainWindow.setOpacity === 'function') {
    mainWindow.setOpacity(1);
  }
  if (typeof mainWindow.showInactive === 'function') {
    mainWindow.showInactive();
  } else {
    mainWindow.show();
  }
  if (typeof mainWindow.moveTop === 'function') {
    mainWindow.moveTop();
  }
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
  showWindowInactive,
  hideWindow,
  destroyWindow,
  syncOrbContentSize,
  setWindowPosition,
  getWindowBounds,
};
