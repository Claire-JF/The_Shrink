/**
 * Main-process session state. Renderer stays a dumb view.
 */

let selectionText = '';
/** @type {object | null} */
let lastScore = null;
/** @type {object | null} */
let lastOptimized = null;

/** @type {{ role: string, content: string }[]} */
let chatMessages = [];

const MAX_CHAT_TURNS = 32;

function reset() {
  selectionText = '';
  lastScore = null;
  lastOptimized = null;
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

function snapshot() {
  return {
    selectionText,
    lastScore,
    lastOptimized,
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
  snapshot,
  snapshotChatMessages,
  pushChatMessage,
  clearChatThread,
};
