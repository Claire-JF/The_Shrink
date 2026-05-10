/**
 * Clipboard facade — hides Electron clipboard from Backend-2-style code paths.
 */
const { clipboard } = require('electron');

let savedText = null;

function readText() {
  return clipboard.readText();
}

/**
 * Snapshot current clipboard text for later restore (used around Ctrl+C simulation).
 */
function pushSnapshot() {
  try {
    savedText = clipboard.readText();
  } catch {
    savedText = '';
  }
}

/**
 * Restore clipboard after capture attempt.
 */
function popSnapshot() {
  if (savedText !== null) {
    clipboard.writeText(savedText);
  }
  savedText = null;
}

/**
 * User clicked Copy — write optimized text only.
 */
async function writeOptimized(text) {
  clipboard.writeText(String(text ?? ''));
}

module.exports = {
  readText,
  pushSnapshot,
  popSnapshot,
  writeOptimized,
};
