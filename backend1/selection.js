/**
 * Selection capture — Windows: Save clipboard → simulate Ctrl+C → read clipboard → restore.
 * Set MOCK_SELECTION=1 or config mockSelection for stub (no OS automation).
 */
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const clipboard = require('./clipboard');

const MOCK =
  'MOCK_SELECTION: highlighted text would appear here (set MOCK_SELECTION=0 for real capture)';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Windows: SendKeys ^c via PowerShell (no extra native npm deps).
 */
async function sendCtrlCWindows() {
  const ps =
    "Add-Type -AssemblyName System.Windows.Forms; " +
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

  clipboard.pushSnapshot();
  try {
    if (process.platform === 'win32') {
      await sendCtrlCWindows();
      await sleep(80);
    } else {
      // Non-Windows: keep architecture portable; real capture added per-OS later.
      const err = new Error(
        'Selection capture is only wired for win32 in this skeleton. Use MOCK_SELECTION=1.'
      );
      err.code = 'PLATFORM_UNSUPPORTED';
      throw err;
    }

    const text = clipboard.readText() || '';
    return {
      text,
      sourceApp: 'foreground',
    };
  } finally {
    clipboard.popSnapshot();
  }
}

module.exports = {
  captureSelection,
  MOCK,
};
