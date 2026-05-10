/**
 * IPC wiring — channel names match TECH_ARCHITECTURE.md.
 */
const { app, ipcMain, shell } = require('electron');
const logger = require('./logger');
const state = require('./state');
const clipboard = require('./clipboard');
const selection = require('./selection');
const config = require('./config');
const brain = require('./brain');
const windowMod = require('./window');
const { readForegroundHWND, pasteIntoHWND } = require('./win-foreground-hwnd');
const CHANNEL = {
  CAPTURE: 'shrink:capture-selection',
  GENERATE: 'shrink:generate-optimized',
  COPY: 'shrink:copy-to-clipboard',
  REPLACE: 'shrink:replace-with-optimized',
  CLOSE: 'shrink:close-widget',
  GET_STATE: 'shrink:get-state',
  GET_CONFIG: 'shrink:get-config',
  OPEN_LOG: 'shrink:open-log',
  SCORE_LIVE: 'shrink:score-live',
  CHAT_SEND: 'shrink:chat-send',
  FORWARD_PROMPT: 'shrink:forward-prompt',
  FORWARD_PREFS_GET: 'shrink:forward-prefs-get',
  FORWARD_PREFS_SET: 'shrink:forward-prefs-set',
};

let handlersBound = false;

function shouldOpenWidget(scoreTotal) {
  const demo = config.get('demoMode');
  if (demo) return true;
  if (scoreTotal == null || Number.isNaN(Number(scoreTotal))) return true;
  return Number(scoreTotal) < config.get('scoreExpandThreshold');
}

/**
 * Selection + HWND into session state (runs after the hover shell may already be visible inactive).
 */
async function runCaptureSelectionPhase({ forced }) {
  const cap = await selection.captureSelection();
  const text = cap.text || '';
  state.setSelection(text);

  const hwnd = await readForegroundHWND();
  state.setSourceForegroundHwnd(hwnd);

  state.setOptimized(null);
  state.setScore(null);

  const open = true;

  logger.info('capture-selection phase done', {
    textLength: text.length,
    open,
    forced,
    demoMode: config.get('demoMode'),
  });

  return {
    capturedText: text,
    sourceApp: cap.sourceApp,
    openWidget: open,
  };
}

async function scoreCapturedText(text) {
  let scoreResult;
  try {
    scoreResult = await brain.score(text);
  } catch (e) {
    logger.error('brain.score failed unexpectedly', { message: e.message });
    scoreResult = brain.fallbackScore();
  }
  state.setScore(scoreResult);
  return scoreResult;
}

async function runCaptureFlow({ forced }) {
  const partial = await runCaptureSelectionPhase({ forced });
  const scoreResult = await scoreCapturedText(partial.capturedText);

  const total = scoreResult && scoreResult.total != null ? scoreResult.total : null;
  logger.info('capture-selection done', {
    textLength: partial.capturedText.length,
    total,
    open: partial.openWidget,
    meetsExpandThreshold: shouldOpenWidget(total),
    forced,
    demoMode: config.get('demoMode'),
  });

  return {
    capturedText: partial.capturedText,
    sourceApp: partial.sourceApp,
    score: scoreResult,
    openWidget: partial.openWidget,
  };
}

function registerIpc() {
  if (handlersBound) return;

  ipcMain.handle(CHANNEL.CAPTURE, async (_e, payload) => {
    const forced = !!(payload && payload.forced);
    logger.info('IPC capture-selection', { forced });
    try {
      return await runCaptureFlow({ forced });
    } catch (e) {
      logger.error('capture-selection error', { message: e.message, code: e.code });
      return {
        capturedText: '',
        sourceApp: 'error',
        score: brain.fallbackScore(),
        openWidget: true,
        error: e.code === 'PLATFORM_UNSUPPORTED' ? e.message : 'Capture failed',
      };
    }
  });

  ipcMain.handle(CHANNEL.GENERATE, async (_e, payload) => {
    const text = state.getSelection();
    const scoreResult = state.getScore();
    const protectedRegions = Array.isArray(payload?.protectedRegions)
      ? payload.protectedRegions
      : [];
    logger.info('IPC generate-optimized', {
      textLength: text.length,
      protectedRegions: protectedRegions.length,
    });
    const optimized = await brain.optimize(text, scoreResult, { protectedRegions });
    state.setOptimized(optimized);
    return optimized;
  });

  ipcMain.handle(CHANNEL.COPY, async (_e, payload) => {
    const opt = state.getOptimized();
    const text =
      payload && payload.text != null ? payload.text : opt?.optimizedText ?? opt?.optimized_text;
    logger.info('IPC copy-to-clipboard', { length: String(text ?? '').length });
    await clipboard.writeOptimized(text ?? '');
    return { ok: true };
  });

  ipcMain.handle(CHANNEL.REPLACE, async () => {
    const opt = state.getOptimized();
    const body =
      opt && typeof opt === 'object'
        ? opt.optimizedText ?? opt.optimized_text ?? ''
        : '';
    const t = String(body ?? '');
    if (!t.trim()) {
      logger.warn('IPC replace-with-optimized: no optimized text');
      return { ok: false, reason: 'no_optimized', clipboard: false, pasted: false };
    }
    logger.info('IPC replace-with-optimized', { length: t.length });
    await clipboard.writeOptimized(t);
    const hwnd = state.getSourceForegroundHwnd();
    let pasted = false;
    if (process.platform === 'win32' && hwnd) {
      const r = pasteIntoHWND(hwnd);
      pasted = !!r.pasted;
      if (!pasted) {
        logger.warn('IPC replace-with-optimized: paste failed', r);
      }
    }
    windowMod.hideWindow();
    return {
      ok: true,
      clipboard: true,
      pasted,
      pasteAttempted: process.platform === 'win32' && !!hwnd,
    };
  });

  ipcMain.handle(CHANNEL.CLOSE, () => {
    logger.info('IPC close-widget');
    windowMod.hideWindow();
    return { ok: true };
  });

  ipcMain.handle(CHANNEL.GET_STATE, () => state.snapshot());

  ipcMain.handle(CHANNEL.GET_CONFIG, () => {
    const llm = config.getLlmConfig();
    return {
      demoMode: config.get('demoMode'),
      scoreExpandThreshold: config.get('scoreExpandThreshold'),
      mockSelection: config.get('mockSelection'),
      logPath: require('./logger').getLogPath(),
      llmConfigured: !!llm.apiKey,
      chatModel: llm.chatModel || llm.deepModel,
    };
  });

  ipcMain.handle(CHANNEL.OPEN_LOG, async () => {
    const p = require('./logger').getLogPath();
    if (!p) return { ok: false };
    const err = await shell.openPath(p);
    return { ok: !err };
  });

  ipcMain.handle(CHANNEL.SCORE_LIVE, async (_e, payload) => {
    const text = typeof payload?.text === 'string' ? payload.text : '';
    logger.info('IPC score-live', { length: text.length });
    if (!text.trim()) {
      return null;
    }
    return brain.score(text);
  });

  ipcMain.handle(CHANNEL.CHAT_SEND, async (_e, payload) => {
    const text = typeof payload?.text === 'string' ? payload.text : '';
    logger.info('IPC chat-send', { length: text.length });
    return brain.sendChatTurn(text);
  });

  ipcMain.handle(CHANNEL.FORWARD_PROMPT, (_e, payload) => {
    const prefsStore = require('./prefs');
    const { forwardPrompt, TARGET_KEYS } = require('./forward-prompt');
    const saved = prefsStore.load(app);
    let fwd =
      typeof payload?.forwardTarget === 'string' && payload.forwardTarget.trim()
        ? payload.forwardTarget.trim().toLowerCase()
        : saved.forwardTarget;
    if (!TARGET_KEYS.includes(fwd)) {
      fwd = saved.forwardTarget || 'clipboard';
    }
    const merged = {
      text: typeof payload?.text === 'string' ? payload.text : '',
      forwardTarget: fwd,
      customProcessBaseName:
        typeof payload?.customProcessBaseName === 'string'
          ? payload.customProcessBaseName
          : saved.customProcessBaseName,
    };
    logger.info('IPC forward-prompt', {
      forwardTarget: merged.forwardTarget,
      len: merged.text.length,
    });
    return forwardPrompt({
      text: merged.text,
      forwardTarget: merged.forwardTarget,
      customProcessBaseName: merged.customProcessBaseName,
    });
  });

  ipcMain.handle(CHANNEL.FORWARD_PREFS_GET, () => require('./prefs').load(app));

  ipcMain.handle(CHANNEL.FORWARD_PREFS_SET, (_e, payload) => {
    const prefsStore = require('./prefs');
    const { TARGET_KEYS } = require('./forward-prompt');
    const cur = prefsStore.load(app);
    let ft =
      typeof payload?.forwardTarget === 'string'
        ? payload.forwardTarget.trim().toLowerCase()
        : cur.forwardTarget;
    if (!TARGET_KEYS.includes(ft)) {
      ft = 'clipboard';
    }
    const next = {
      ...cur,
      forwardTarget: ft,
      ...(typeof payload?.customProcessBaseName === 'string'
        ? { customProcessBaseName: payload.customProcessBaseName.trim() }
        : {}),
    };
    prefsStore.save(app, next);
    return next;
  });

  handlersBound = true;
  logger.info('IPC handlers registered');
}

module.exports = {
  registerIpc,
  CHANNEL,
  shouldOpenWidget,
  runCaptureFlow,
  runCaptureSelectionPhase,
  scoreCapturedText,
};
