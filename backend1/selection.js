/**
 * Selection capture — Windows:
 * 1) Prefer UI Automation TextPattern selection on the focused control (no clipboard).
 * 2) Fall back: save clipboard → Ctrl+C → read clipboard → restore.
 * Set MOCK_SELECTION=1 or config.mockSelection for stub (no OS automation).
 *
 * Set DISABLE_UIA_SELECTION=1 to skip UIA and use clipboard copy only.
 */
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const clipboard = require('./clipboard');
const logger = require('./logger');

const MOCK =
  'MOCK_SELECTION: highlighted text would appear here (set MOCK_SELECTION=0 for real capture)';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function uiaDisabled() {
  return String(process.env.DISABLE_UIA_SELECTION || '').trim() === '1';
}

/**
 * Windows: read focused element's UIA text selection (Base64 UTF-8 on stdout).
 * @returns {Promise<string>}
 */
async function readSelectionUiaWindows() {
  const script = path.join(__dirname, '..', 'scripts', 'win-selection-uia.ps1');
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-File',
        script,
      ],
      {
        timeout: 8000,
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 12 * 1024 * 1024,
      }
    );
    const line = String(stdout || '').trim();
    if (!line) return '';
    return Buffer.from(line, 'base64').toString('utf8');
  } catch (e) {
    logger.warn('UI Automation selection failed, will fall back to clipboard', {
      message: e.message,
    });
    return '';
  }
}

/**
 * Windows: SendKeys ^c via PowerShell (no extra native npm deps).
 */
async function sendCtrlCWindows() {
  const ps =
    'Add-Type -AssemblyName System.Windows.Forms; ' +
    '[System.Windows.Forms.SendKeys]::SendWait("^c")';
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps],
    { timeout: 8000, windowsHide: true }
  );
}

async function captureSelection() {
  const config = require('./config');
  if (config.get('mockSelection')) {
    return { text: MOCK, sourceApp: 'mock' };
  }

  if (process.platform === 'win32') {
    if (!uiaDisabled()) {
      const uiaText = await readSelectionUiaWindows();
      if (typeof uiaText === 'string' && uiaText.length > 0) {
        logger.info('selection captured via UI Automation', { length: uiaText.length });
        return {
          text: uiaText,
          sourceApp: 'uia',
        };
      }
      logger.info('UI Automation returned empty; falling back to Ctrl+C clipboard');
    }

    clipboard.pushSnapshot();
    try {
      await sendCtrlCWindows();
      await sleep(80);
      const text = clipboard.readText() || '';
      logger.info('selection captured via clipboard (Ctrl+C)', { length: text.length });
      return {
        text,
        sourceApp: 'clipboard-copy',
      };
    } finally {
      clipboard.popSnapshot();
    }
  }

  const err = new Error(
    'Selection capture uses UI Automation + clipboard on Windows only in this build. Use MOCK_SELECTION=1.'
  );
  err.code = 'PLATFORM_UNSUPPORTED';
  throw err;
}

module.exports = {
  captureSelection,
  MOCK,
};
