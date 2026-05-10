/**
 * Read the HWND of the current foreground window (Windows only).
 */
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

async function readForegroundHWND() {
  if (process.platform !== 'win32') {
    return null;
  }

  const csharp =
    'using System;using System.Runtime.InteropServices;public static class WinFgHwnd{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();}';
  const ps = `Add-Type -TypeDefinition '${csharp}' ; [WinFgHwnd]::GetForegroundWindow().ToInt64()`;

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps],
      { timeout: 6000, windowsHide: true, encoding: 'utf8' }
    );
    const n = Number(String(stdout || '').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Activate a window by HWND and send Ctrl+V (clipboard must already hold payload).
 */
function pasteIntoHWND(hwnd) {
  if (process.platform !== 'win32') {
    return { ok: false, pasted: false, reason: 'platform' };
  }
  const h = typeof hwnd === 'number' ? hwnd : Number(hwnd);
  if (!Number.isFinite(h) || h <= 0) {
    return { ok: false, pasted: false, reason: 'no_hwnd' };
  }

  const path = require('path');
  const { spawnSync } = require('child_process');

  const script = path.join(__dirname, '..', 'scripts', 'win-paste-foreground.ps1');
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Hwnd', String(Math.trunc(h))];

  try {
    const r = spawnSync('powershell.exe', args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15_000,
    });
    const code = r.status === null ? 1 : r.status;
    const pasted = code === 0;
    return { ok: pasted, pasted, exit: code };
  } catch (e) {
    return { ok: false, pasted: false, error: e.message };
  }
}

module.exports = {
  readForegroundHWND,
  pasteIntoHWND,
};
