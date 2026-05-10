/**
 * Main-process session state. Renderer stays a dumb view.
 */

let selectionText = '';
/** @type {object | null} */
let lastScore = null;
/** @type {object | null} */
let lastOptimized = null;

/** Win32 HWND of the foreground window right after capture (best-effort paste target). */
let sourceForegroundHwnd = null;

/** @type {{ role: string, content: string }[]} */
let chatMessages = [];

const MAX_CHAT_TURNS = 32;

function reset() {
  selectionText = '';
  lastScore = null;
  lastOptimized = null;
  sourceForegroundHwnd = null;
}

function snapshotChatMessages() {
  return chatMessages.map((m) => ({ role: m.role, content: m.content }));
}

function pushChatMessage(role, content) {
  chatMessages.push({
    role,
    content: typeof content === 'string' ? content : '',
  });
  while (chatMessages.length > MAX_CHAT_TURNS) {
    chatMessages.shift();
  }
}

function clearChatThread() {
  chatMessages = [];
}

function setSelection(text) {
  selectionText = typeof text === 'string' ? text : '';
}

function getSelection() {
  return selectionText;
}

function setScore(score) {
  lastScore = score;
}

function getScore() {
  return lastScore;
}

function setOptimized(obj) {
  lastOptimized = obj;
}

function getOptimized() {
  return lastOptimized;
}

function setSourceForegroundHwnd(n) {
  const v = typeof n === 'number' ? n : Number(n);
  sourceForegroundHwnd = Number.isFinite(v) && v > 0 ? v : null;
}

function getSourceForegroundHwnd() {
  return sourceForegroundHwnd;
}

function snapshot() {
  return {
    selectionText,
    lastScore,
    lastOptimized,
    sourceForegroundHwnd,
    chatMessages: snapshotChatMessages(),
  };
}

module.exports = {
  reset,
  setSelection,
  getSelection,
  setScore,
  getScore,
  setOptimized,
  getOptimized,
  setSourceForegroundHwnd,
  getSourceForegroundHwnd,
  snapshot,
  snapshotChatMessages,
  pushChatMessage,
  clearChatThread,
};
