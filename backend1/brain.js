/**
 * Adapter to Backend-2 (ESM under /src). See INTEGRATION_CONTRACT.md.
 */
const path = require('path');
const { pathToFileURL } = require('url');

let indexModule;
let initPromise;
let client;
let llmConfig;

function getIndexUrl() {
  return pathToFileURL(path.join(__dirname, '..', 'src', 'index.js')).href;
}

async function loadIndex() {
  if (!indexModule) {
    indexModule = await import(getIndexUrl());
  }
  return indexModule;
}

function getLlmConfig() {
  return require('./config').getLlmConfig();
}

/**
 * One-time: create LLM client, handshake/warmup.
 */
async function initBrain() {
  if (!initPromise) {
    initPromise = (async () => {
      llmConfig = getLlmConfig();
      const mod = await loadIndex();
      client = llmConfig.apiKey ? mod.createClient(llmConfig) : mod.createMockClient();
      await mod.warmup(client, llmConfig);
    })();
  }
  await initPromise;
}

async function score(text) {
  await initBrain();
  const mod = await loadIndex();
  return mod.score(text, client, llmConfig);
}

async function optimize(text, scoreResult, options) {
  await initBrain();
  const mod = await loadIndex();
  return mod.optimize(text, scoreResult, client, llmConfig, options || {});
}

/**
 * Conversation send — appends user + assistant bubbles in main-process state.
 */
async function sendChatTurn(userText) {
  await initBrain();
  const trimmed = typeof userText === 'string' ? userText.trim() : '';
  if (!trimmed) {
    return { role: 'assistant', content: '' };
  }

  const state = require('./state');
  state.pushChatMessage('user', trimmed);

  const history = state.snapshotChatMessages();
  const mod = await loadIndex();
  let reply;
  try {
    reply = await mod.chat(history, client, llmConfig);
  } catch (e) {
    reply = { role: 'assistant', content: `对话失败：${e?.message || e}` };
  }

  state.pushChatMessage('assistant', reply.content || '');
  return reply;
}

async function warmup() {
  await initBrain();
}

/**
 * Only for non-Backend-2 failures (e.g. selection transport).
 * Matches Backend-2 failure shape from INTEGRATION_CONTRACT.md.
 */
function fallbackScore() {
  return {
    clarity: 3.0,
    specificity: 3.0,
    safety: 3.0,
    tone: 3.0,
    actionability: 3.0,
    total: 3.0,
    summary: 'Unable to score',
  };
}

module.exports = {
  initBrain,
  score,
  optimize,
  warmup,
  fallbackScore,
  sendChatTurn,
};
