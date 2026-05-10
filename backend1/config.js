/**
 * Central config — env, CLI flags, defaults. Backend-2 reads LLM keys via same keys when wired.
 */
const argv = new Set(process.argv.slice(2));

function parseBool(v, defaultValue) {
  if (v === undefined || v === '') return defaultValue;
  const s = String(v).toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return defaultValue;
}

const defaults = {
  scoreExpandThreshold: 3.0,
  /** When true, skip "score < threshold" gating — widget always opens (demo judging). */
  demoMode: argv.has('--demo-mode') || parseBool(process.env.DEMO_MODE, false),
  /** Stub selection without OS automation (CI / headless). */
  mockSelection: parseBool(process.env.MOCK_SELECTION, false),
  /** Log file under userData */
  logFileName: 'the-shrink-plumbing.log',
};

const store = { ...defaults };

function loadFromEnv() {
  if (process.env.SCORE_EXPAND_THRESHOLD != null && process.env.SCORE_EXPAND_THRESHOLD !== '') {
    const n = Number(process.env.SCORE_EXPAND_THRESHOLD);
    if (!Number.isNaN(n)) store.scoreExpandThreshold = n;
  }
}

loadFromEnv();

/**
 * Values consumed by Backend-2 (INTEGRATION_CONTRACT.md).
 */
function getLlmConfig() {
  const deepModel = (process.env.LLM_DEEP_MODEL || 'DeepSeek V3').trim();
  return {
    baseURL: (process.env.LLM_BASE_URL || 'https://api.clod.io/v1').trim(),
    apiKey: (process.env.CLOD_API_KEY || '').trim(),
    fastModel: (process.env.LLM_FAST_MODEL || 'DeepSeek V3').trim(),
    deepModel,
    /** Conversation turn (Send). Defaults to deep model unless LLM_CHAT_MODEL set. */
    chatModel: (process.env.LLM_CHAT_MODEL || deepModel || 'DeepSeek V3').trim(),
  };
}

function get(key) {
  return store[key];
}

function set(key, value) {
  store[key] = value;
}

/**
 * Toggle demo mode at runtime (Cmd+Shift+D).
 */
function toggleDemoMode() {
  store.demoMode = !store.demoMode;
  return store.demoMode;
}

module.exports = {
  get,
  set,
  toggleDemoMode,
  getLlmConfig,
};
