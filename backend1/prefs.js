/**
 * Minimal JSON prefs in userData (no extra deps).
 */
const fs = require('fs');
const path = require('path');

const FILE = 'shrink-ui-prefs.json';

let cache = null;
let prefsPathResolved = '';

function prefsPath(app) {
  const base = typeof app?.getPath === 'function' ? app.getPath('userData') : '';
  prefsPathResolved = path.join(base, FILE);
  return prefsPathResolved;
}

function defaults() {
  return {
    /** clipboard | cursor | codex | claude | vscode | windsurf | custom */
    forwardTarget: 'clipboard',
    /** When forwardTarget=custom — Windows-process base name WITHOUT .exe (e.g. MyApp) */
    customProcessBaseName: '',
  };
}

function load(app) {
  if (!app) return { ...defaults() };
  const p = prefsPath(app);
  try {
    if (fs.existsSync(p)) {
      cache = JSON.parse(fs.readFileSync(p, 'utf8'));
      return { ...defaults(), ...cache };
    }
  } catch {
    /* ignore */
  }
  cache = defaults();
  return { ...cache };
}

function save(app, next) {
  if (!app) return;
  const p = prefsPath(app);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf8');
    cache = next;
  } catch {
    /* ignore */
  }
}

function update(app, patch) {
  const cur = load(app);
  const merged = { ...cur, ...patch };
  save(app, merged);
  return merged;
}

module.exports = {
  prefsPathResolved: () => prefsPathResolved,
  load,
  save,
  update,
};
