/* global LiveHeuristic, MockLiveDebouncer, shrink, mockShell */

const composer = document.getElementById('composer');
const sendBtn = document.getElementById('sendBtn');
const replyPanel = document.getElementById('replyPanel');
const replyBody = document.getElementById('replyBody');
const statusLine = document.getElementById('statusLine');
const collapseBtn = document.getElementById('collapseBtn');
const forwardTarget = document.getElementById('forwardTarget');
const customProc = document.getElementById('customProc');

const debouncer = MockLiveDebouncer.createLiveDebouncer();

let lenAtCloud = 0;
let cloudSeq = 0;
let collapsedReply = false;

let fwdSaveTimer = null;

function resizeShellWindow() {
  const replyHidden = replyPanel.classList.contains('hidden') || collapsedReply;
  const compact = replyHidden;
  /** Extra chrome for forwarding toolbar (~48px vs single row layouts). */
  const h = compact ? 210 : 384;
  mockShell.resizeBar(Math.round(h));
}

function pushTelemetry(patch) {
  if (mockShell.telemetry) mockShell.telemetry(patch);
}

function setStatusBusy(on, label) {
  statusLine.textContent = on ? label : '本地预览 · 待机';
  statusLine.classList.toggle('transitioning', on);
}

function toggleCustomVisibility() {
  const on = forwardTarget.value === 'custom';
  customProc.classList.toggle('hidden', !on);
}

function scheduleForwardPrefsPersist() {
  clearTimeout(fwdSaveTimer);
  fwdSaveTimer = setTimeout(async () => {
    try {
      await shrink.setForwardPrefs({
        forwardTarget: forwardTarget.value,
        customProcessBaseName: customProc.value.trim(),
      });
    } catch {
      /* ignore */
    }
  }, 220);
}

function applyLocalPreview(score) {
  pushTelemetry({
    analyzing: false,
    tier: 'preview',
    total: score?.total ?? null,
    summary: score?.summary || '',
  });
}

async function cloudScore(text) {
  cloudSeq++;
  const my = cloudSeq;
  if (!text.trim()) {
    applyLocalPreview(LiveHeuristic.score(''));
    return;
  }
  setStatusBusy(true, '云端精评中…');
  pushTelemetry({ analyzing: true });
  try {
    const score = await shrink.scoreLive({ text });
    if (my !== cloudSeq) return;
    if (score && typeof score === 'object') {
      pushTelemetry({
        analyzing: false,
        tier: 'refined',
        total: score.total ?? null,
        summary: score.summary || '',
      });
      lenAtCloud = text.length;
    }
  } catch {
    if (my === cloudSeq) {
      pushTelemetry({ analyzing: false, tier: 'preview' });
    }
  } finally {
    if (my === cloudSeq) {
      setStatusBusy(false);
    }
  }
}

composer.addEventListener('input', (e) => {
  const text = composer.value;
  const inserted = e.data ?? '';
  applyLocalPreview(LiveHeuristic.score(text));

  debouncer.reset(
    text,
    lenAtCloud,
    () => cloudScore(text),
    (t) => cloudScore(t)
  );

  if (MockLiveDebouncer.structuralBreak(text, inserted)) {
    debouncer.pokeBurst(text, cloudScore);
  }

  collapsedReply = false;
});

composer.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    sendComposer();
  }
  if (e.key === 'Escape') {
    mockShell.dismissBoth();
  }
});

forwardTarget.addEventListener('change', () => {
  toggleCustomVisibility();
  scheduleForwardPrefsPersist();
  resizeShellWindow();
});

customProc.addEventListener('input', () => scheduleForwardPrefsPersist());

async function sendComposer() {
  const t = composer.value.trim();
  if (!t || sendBtn.disabled) return;
  sendBtn.disabled = true;
  collapsedReply = false;
  replyPanel.classList.remove('hidden');
  replyBody.textContent = '转发 + 内置对话请求中…';
  collapseBtn.classList.remove('hidden');
  resizeShellWindow();

  pushTelemetry({ analyzing: true, chatSending: true });

  try {
    const fwdResult = await shrink.forwardPrompt({
      text: t,
      forwardTarget: forwardTarget.value,
      customProcessBaseName: customProc.value.trim(),
    });

    let forwardNote = '';
    if (fwdResult?.pasted) {
      forwardNote = '外链：尝试粘贴成功 · ';
    } else if (fwdResult?.clipboard) {
      forwardNote =
        fwdResult.reason === 'window_not_found'
          ? '外链：窗口未找到 · 文本已写入剪贴板 · '
          : fwdResult.reason === 'platform'
            ? '外链：当前系统仅复制剪贴板 · '
            : '外链：文本已就绪 · ';
    }

    const res = await shrink.chatSend({ text: t });
    replyBody.textContent = res?.content || '（空回复）';
    statusLine.textContent = `${forwardNote}内置助手已回复`;
    statusLine.classList.add('transitioning');
    setTimeout(() => statusLine.classList.remove('transitioning'), 800);
  } catch (err) {
    replyBody.textContent = String(err?.message || err || '发送失败');
    statusLine.textContent = '发送失败 · 仍可手动粘贴剪贴板';
  } finally {
    sendBtn.disabled = false;
    pushTelemetry({ analyzing: false, chatSending: false });
    resizeShellWindow();
    composer.focus();
  }
}

sendBtn.addEventListener('click', sendComposer);

collapseBtn.addEventListener('click', () => {
  collapsedReply = !collapsedReply;
  replyPanel.classList.toggle('hidden', collapsedReply);
  collapseBtn.textContent = collapsedReply ? '展开回复' : '收起回复';
  resizeShellWindow();
});

composer.addEventListener('focus', () => {
  collapsedReply = false;
  replyPanel.classList.toggle('hidden', false);
  resizeShellWindow();
});

async function hydrateForwardPrefs() {
  try {
    const prefs = await shrink.getForwardPrefs();
    if (prefs?.forwardTarget) {
      forwardTarget.value = prefs.forwardTarget;
    }
    if (prefs?.customProcessBaseName) {
      customProc.value = prefs.customProcessBaseName;
    }
  } catch {
    /* ignore */
  }
  toggleCustomVisibility();
}

hydrateForwardPrefs().then(() => {
  resizeShellWindow();
  composer.focus();
});
