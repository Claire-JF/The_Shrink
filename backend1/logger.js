/**
 * Append-only file log for IPC and external calls. Initializes after app is ready.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let logPath = null;

function init(app) {
  const dir = app.getPath('userData');
  const cfg = require('./config');
  logPath = path.join(dir, cfg.get('logFileName'));
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
  info('logger initialized', { logPath });
}

function line(level, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level}] ${message}`;
  const extra =
    meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return base + extra + '\n';
}

function append(raw) {
  if (!logPath) return;
  try {
    fs.appendFileSync(logPath, raw, 'utf8');
  } catch (e) {
    console.error('[logger] append failed', e);
  }
}

function info(message, meta) {
  const raw = line('INFO', message, meta);
  append(raw);
  console.log(raw.trimEnd());
}

function warn(message, meta) {
  const raw = line('WARN', message, meta);
  append(raw);
  console.warn(raw.trimEnd());
}

function error(message, meta) {
  const raw = line('ERROR', message, meta);
  append(raw);
  console.error(raw.trimEnd());
}

function getLogPath() {
  return logPath;
}

function getLogFileUrl() {
  if (!logPath) return null;
  return pathToFileURL(logPath).href;
}

module.exports = {
  init,
  info,
  warn,
  error,
  getLogPath,
  getLogFileUrl,
};
