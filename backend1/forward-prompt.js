/**
 * Copy user draft to clipboard and (Windows) attempt focus + Ctrl+V toward a preset host app.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { clipboard } = require('electron');
const logger = require('./logger');

const TARGET_KEYS = ['clipboard', 'cursor', 'codex', 'claude', 'vscode', 'windsurf', 'custom'];

function maxLen(s, max) {
  const t = typeof s === 'string' ? s : '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * @param {{ text: unknown, forwardTarget?: string, customProcessBaseName?: string }} args
 */
function forwardPrompt({ text, forwardTarget, customProcessBaseName }) {
  const body = maxLen(String(text ?? ''), 120_000);
  clipboard.writeText(body);

  let targetKey =
    typeof forwardTarget === 'string' ? forwardTarget.toLowerCase().trim() : 'clipboard';

  if (!TARGET_KEYS.includes(targetKey)) {
    targetKey = 'clipboard';
  }

  if (targetKey === 'clipboard') {
    logger.info('forward: clipboard-only');
    return { ok: true, clipboard: true, pasted: false };
  }

  if (process.platform !== 'win32') {
    logger.warn('forward: auto-paste is Windows-only; clipboard set');
    return { ok: true, clipboard: true, pasted: false, reason: 'platform' };
  }

  const tmpPath = path.join(os.tmpdir(), `shrink-fwd-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(tmpPath, body, 'utf8');

  const script = path.join(__dirname, '..', 'scripts', 'win-forward-paste.ps1');
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-PayloadPath', tmpPath];

  const custom =
    typeof customProcessBaseName === 'string'
      ? customProcessBaseName.replace(/[/\\]?\.exe$/i, '').trim()
      : '';
  if (targetKey === 'custom') {
    if (!custom) {
      fs.unlink(tmpPath, () => {});
      logger.warn('forward: custom target missing ProcessBaseName');
      return { ok: true, clipboard: true, pasted: false, reason: 'custom_empty' };
    }
    args.push('-ProcessBaseName', custom);
  } else {
    args.push('-Target', targetKey);
  }

  try {
    const r = spawnSync('powershell.exe', args, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 25_000,
    });
    fs.unlink(tmpPath, () => {});

    const code = r.status === null ? 1 : r.status;
    logger.info('forward: powershell paste', {
      targetKey,
      exit: code,
      stderr: ((r.stderr || '') + '').slice(0, 300),
    });
    if (code === 10) {
      return { ok: true, clipboard: true, pasted: false, reason: 'window_not_found' };
    }
    return { ok: code === 0, clipboard: true, pasted: code === 0, exit: code };
  } catch (e) {
    fs.unlink(tmpPath, () => {});
    logger.warn('forward: powershell failed', { message: e.message });
    return { ok: false, clipboard: true, pasted: false, error: e.message };
  }
}

module.exports = {
  forwardPrompt,
  TARGET_KEYS,
};
