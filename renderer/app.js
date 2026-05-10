/* global shrink */

/** Source text for the captured prompt (single source for offsets). */
let sourcePlain = '';
/** Half-open intervals merged & clamped — user-defined protected spans. */
let userProtectedRegions = [];

function $(id) {
  return document.getElementById(id);
}

function setScore(score) {
  const t = score && score.total != null ? Number(score.total).toFixed(2) : '—';
  $('scoreLabel').textContent = `Score ${t} / 5.0`;
}

function setBusyOverlay(visible, message) {
  const overlay = $('loadingOverlay');
  const msgEl = $('loadingMessage');
  if (!overlay || !msgEl) return;
  overlay.classList.toggle('hidden', !visible);
  overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
  msgEl.textContent = message || 'Please wait…';
}

function normalizeRegions(raw, length) {
  if (!length) return [];
  const rows = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== 'object') continue;
    const s = Number(r.start);
    const e = Number(r.end);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    const start = Math.max(0, Math.min(length, Math.floor(s)));
    const end = Math.max(0, Math.min(length, Math.ceil(e)));
    if (end > start) rows.push({ start, end });
  }
  rows.sort((a, b) => a.start - b.start);
  /** @type {{ start: number; end: number }[]} */
  const merged = [];
  for (const r of rows) {
    const prev = merged[merged.length - 1];
    if (!prev || r.start > prev.end) merged.push({ ...r });
    else prev.end = Math.max(prev.end, r.end);
  }
  return merged;
}

function mergeUserInterval(start, end) {
  sourcePlain = sourcePlain || '';
  const len = sourcePlain.length;
  if (!(end > start) || len < 1) return;
  const next = [...userProtectedRegions, { start, end }];
  userProtectedRegions = normalizeRegions(next, len);
  renderOriginalHost();
}

function removeProtBySpan(span) {
  const s = Number(span.dataset.protStart);
  const e = Number(span.dataset.protEnd);
  userProtectedRegions = userProtectedRegions.filter((r) => !(r.start === s && r.end === e));
  renderOriginalHost();
}

function appendTextFragment(el, str) {
  el.appendChild(document.createTextNode(str));
}

/** @param {HTMLElement} host */
function getSelectionOffsetsIn(host) {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed || !host) return null;

  const range = sel.getRangeAt(0);
  if (!host.contains(range.commonAncestorContainer)) return null;

  const pre = document.createRange();
  pre.selectNodeContents(host);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const selected = range.toString();
  const end = start + selected.length;

  if (!(end > start)) return null;
  if (start >= 0 && end <= sourcePlain.length && sourcePlain.slice(start, end) === selected) {
    return { start, end };
  }

  /** Rare layout drift — substring search fallback */
  const idx = sourcePlain.indexOf(selected);
  if (idx !== -1) return { start: idx, end: idx + selected.length };

  return null;
}

/** Render original column with clickable protected spans */
function renderOriginalHost() {
  const host = $('originalHost');
  if (!host) return;
  host.innerHTML = '';
  sourcePlain = sourcePlain ?? '';
  if (!sourcePlain) {
    appendTextFragment(host, '—');
    return;
  }
  const regs = normalizeRegions(userProtectedRegions, sourcePlain.length);
  userProtectedRegions = regs;
  let cursor = 0;
  for (const r of regs) {
    appendTextFragment(host, sourcePlain.slice(cursor, r.start));
    const span = document.createElement('span');
    span.className = 'orig-prot';
    span.dataset.protStart = String(r.start);
    span.dataset.protEnd = String(r.end);
    span.textContent = sourcePlain.slice(r.start, r.end);
    span.title = '单击取消保留';
    host.appendChild(span);
    cursor = r.end;
  }
  appendTextFragment(host, sourcePlain.slice(cursor));
}

/**
 * Sorted non-overlapping intervals for highlighting optimized output (model coordinates).
 * @param {{ start: number; end: number }[]} regions
 */
function sortCleanRegions(length, regions) {
  /** @type {{ start: number; end: number }[]} */
  const rows = [];
  for (const r of Array.isArray(regions) ? regions : []) {
    if (!r || typeof r !== 'object') continue;
    let s = Math.max(0, Math.floor(Number(r.start)));
    let e = Math.max(0, Math.ceil(Number(r.end)));
    if (!(e > s)) continue;
    s = Math.min(length, Math.max(0, s));
    e = Math.min(length, Math.max(0, e));
    if (e > s) rows.push({ start: s, end: e });
  }
  rows.sort((a, b) => a.start - b.start);
  /** Merge overlaps for clearer paint */
  /** @type {{ start: number; end: number }[]} */
  const merged = [];
  for (const r of rows) {
    const prev = merged[merged.length - 1];
    if (!prev || r.start > prev.end) merged.push({ ...r });
    else prev.end = Math.max(prev.end, r.end);
  }
  return merged;
}

function renderOptimizedHost(fullText, protectedRegionsMeta) {
  const el = $('optimized');
  if (!el) return;
  el.innerHTML = '';

  const L = typeof fullText === 'string' ? fullText.length : 0;
  const regs = sortCleanRegions(L, protectedRegionsMeta);
  let cursor = 0;
  for (const r of regs) {
    appendTextFragment(el, fullText.slice(cursor, r.start));
    const span = document.createElement('span');
    span.className = 'opt-protected';
    span.textContent = fullText.slice(r.start, r.end);
    el.appendChild(span);
    cursor = r.end;
  }
  appendTextFragment(el, fullText.slice(cursor));
}

const DIM_KEYS = ['clarity', 'emotionalBalance', 'safety'];
const DIM_LABEL = {
  clarity: 'Clarity',
  emotionalBalance: 'Emotional balance',
  safety: 'Safety',
};

function renderScoreDetails(score) {
  const ul = $('flags');
  ul.innerHTML = '';

  if (score && typeof score.summary === 'string' && score.summary.trim()) {
    const li = document.createElement('li');
    li.textContent = score.summary.trim();
    ul.appendChild(li);
  }

  DIM_KEYS.forEach((k) => {
    if (score == null || score[k] == null) return;
    const li = document.createElement('li');
    const v = Number(score[k]).toFixed(1);
    li.textContent = `${DIM_LABEL[k] || k}: ${v} / 5.0`;
    li.style.opacity = '0.9';
    ul.appendChild(li);
  });

  if (!ul.children.length) {
    const li = document.createElement('li');
    li.textContent = '—';
    ul.appendChild(li);
  }
}

function renderChanges(opt) {
  const list = $('changes');
  list.innerHTML = '';
  const arr = opt && Array.isArray(opt.changes) ? opt.changes : [];
  if (!arr.length) {
    list.classList.add('hidden');
    return;
  }
  list.classList.remove('hidden');
  arr.forEach((c) => {
    const li = document.createElement('li');
    li.textContent = String(c);
    list.appendChild(li);
  });
}

function pickOptimizedText(opt) {
  if (!opt || typeof opt !== 'object') return '';
  if (typeof opt.optimizedText === 'string') return opt.optimizedText;
  if (typeof opt.optimized_text === 'string') return opt.optimized_text;
  return '';
}

function applySafetyBanner(visible, message) {
  const b = $('safetyBanner');
  if (!b) return;
  b.classList.toggle('hidden', !visible);
  if (visible) {
    b.textContent =
      message || '因安全评分低于 2.0，本轮已忽略您在原文中标记的保护区域，并对全文作了改写。';
  } else {
    b.textContent = '';
  }
}

function showLoadingState() {
  sourcePlain = '';
  userProtectedRegions = [];
  applySafetyBanner(false, '');
  $('rightTitle').textContent = '';
  $('optimized').classList.add('hidden');
  $('btnCopy').classList.add('hidden');
  $('btnReplace').classList.add('hidden');
  $('changes').classList.add('hidden');
  $('flags').classList.add('hidden');
  const host = $('originalHost');
  if (host) {
    host.innerHTML = '';
    appendTextFragment(host, '…');
  }
  setScore(null);
  $('btnGenerate').disabled = true;
  setBusyOverlay(true, 'Reading selection & scoring…');
}

/** Pop-up shown immediately on hotkey; host app still has focus while we read the selection. */
function showCaptureAwaitingSelection() {
  applySafetyBanner(false, '');
  $('rightTitle').textContent = 'Score';
  $('optimized').classList.add('hidden');
  $('btnCopy').classList.add('hidden');
  $('btnReplace').classList.add('hidden');
  $('changes').classList.add('hidden');
  $('flags').classList.add('hidden');
  sourcePlain = '';
  userProtectedRegions = [];
  const host = $('originalHost');
  if (host) {
    host.innerHTML = '';
    appendTextFragment(host, '…');
  }
  setScore(null);
  $('btnGenerate').disabled = true;
  setBusyOverlay(true, 'Reading selection…');
}

/** After selection text is known, while the main process is still awaiting `score()`. */
function showCaptureScoringPending(payload) {
  applySafetyBanner(false, '');
  $('rightTitle').textContent = 'Score';
  $('optimized').classList.add('hidden');
  $('btnCopy').classList.add('hidden');
  $('btnReplace').classList.add('hidden');
  $('changes').classList.add('hidden');
  $('flags').classList.add('hidden');

  let text = typeof payload?.capturedText === 'string' ? payload.capturedText : '';
  if (payload.error) {
    text = `(Error) ${payload.error}${text ? `\n${text}` : ''}`.trim();
  }

  sourcePlain = text || '';
  userProtectedRegions = [];
  $('originalHost').focus({ preventScroll: true });
  renderOriginalHost();

  setScore(null);
  $('btnGenerate').disabled = true;
  setBusyOverlay(true, 'Scoring…');
}

function showState1(payload) {
  setBusyOverlay(false);
  applySafetyBanner(false, '');
  $('rightTitle').textContent = 'Score';
  $('optimized').classList.add('hidden');
  $('btnCopy').classList.add('hidden');
  $('btnReplace').classList.add('hidden');
  $('flags').classList.remove('hidden');
  $('changes').classList.add('hidden');

  let text = typeof payload?.capturedText === 'string' ? payload.capturedText : '';
  if (payload.error) {
    text = `(Error) ${payload.error}${text ? `\n${text}` : ''}`.trim();
  }

  sourcePlain = text || '';
  userProtectedRegions = [];
  $('originalHost').focus({ preventScroll: true });
  renderOriginalHost();

  setScore(payload.score);
  renderScoreDetails(payload.score);
  $('btnGenerate').disabled = false;
}

function showState2(opt) {
  setBusyOverlay(false);
  $('rightTitle').textContent = 'Optimized';
  $('flags').classList.add('hidden');
  $('optimized').classList.remove('hidden');
  $('btnCopy').classList.remove('hidden');
  $('btnReplace').classList.remove('hidden');

  applySafetyBanner(!!opt.safetyOverride);

  const full = pickOptimizedText(opt);
  const pr = opt && Array.isArray(opt.protectedRegions) ? opt.protectedRegions : [];
  const coords = pr.map((p) =>
    p && typeof p === 'object'
      ? { start: Number(p.start), end: Number(p.end) }
      : { start: 0, end: 0 },
  );

  if (full && opt?.safetyOverride) {
    $('optimized').innerHTML = '';
    $('optimized').textContent = full;
  } else if (full) {
    renderOptimizedHost(full, coords);
  } else {
    $('optimized').innerHTML = '';
  }

  renderChanges(opt);
  $('btnGenerate').disabled = true;
}

async function refreshConfigBanner() {
  const cfg = await shrink.getConfig();
  $('demoBadge').classList.toggle('hidden', !cfg.demoMode);
  const badge = $('llmBadge');
  if (badge) {
    badge.classList.toggle('llm-live', !!cfg.llmConfigured);
    badge.classList.toggle('llm-mock', !cfg.llmConfigured);
    badge.textContent = cfg.llmConfigured ? 'CLōD' : 'MOCK LLM';
  }
}

function wireProtectedSelectionUI() {
  const host = $('originalHost');
  if (!host) return;

  host.addEventListener('click', (e) => {
    const prot = e.target.closest('.orig-prot');
    if (prot && host.contains(prot)) {
      e.preventDefault();
      removeProtBySpan(prot);
    }
  });

  host.addEventListener('mouseup', () => {
    requestAnimationFrame(() => {
      if (!sourcePlain.trim()) return;
      const offsets = getSelectionOffsetsIn(host);
      const sel = window.getSelection();
      if (offsets) mergeUserInterval(offsets.start, offsets.end);
      if (sel && typeof sel.removeAllRanges === 'function') sel.removeAllRanges();
    });
  });
}

async function bootstrap() {
  await refreshConfigBanner();

  shrink.onPresentation((msg) => {
    if (!msg) return;
    if (msg.type === 'loading') {
      showLoadingState();
    }
    if (msg.type === 'capture' && msg.payload) {
      if (msg.payload.loading) {
        if (msg.payload.phase === 'selection') {
          showCaptureAwaitingSelection();
        } else {
          showCaptureScoringPending(msg.payload);
        }
      } else {
        showState1(msg.payload);
      }
    }
    if (msg.type === 'config' && msg.payload) {
      $('demoBadge').classList.toggle('hidden', !msg.payload.demoMode);
    }
  });

  wireProtectedSelectionUI();

  $('btnClose').addEventListener('click', () => shrink.closeWidget());

  $('btnGenerate').addEventListener('click', async () => {
    $('btnGenerate').disabled = true;
    setBusyOverlay(true, 'Optimizing prompt…');
    const regionsPayload = normalizeRegions(userProtectedRegions, sourcePlain.length);
    userProtectedRegions = regionsPayload;

    let result;
    try {
      result = await shrink.generateOptimized({ protectedRegions: regionsPayload });
    } finally {
      setBusyOverlay(false);
    }

    const body = pickOptimizedText(result);
    if (body) {
      showState2(result);
    } else {
      $('btnGenerate').disabled = false;
      $('btnReplace').classList.add('hidden');
      $('optimized').classList.remove('hidden');
      $('optimized').innerHTML = '';
      $('optimized').textContent = 'Generate failed or empty result';
    }
  });

  $('btnCopy').addEventListener('click', async () => {
    const t = $('optimized').textContent || '';
    await shrink.copyToClipboard({ text: t });
    const b = $('btnCopy');
    const prev = b.textContent;
    b.textContent = 'Copied';
    setTimeout(() => {
      b.textContent = prev;
    }, 900);
  });

  $('btnReplace').addEventListener('click', async () => {
    const b = $('btnReplace');
    b.disabled = true;
    try {
      const r = await shrink.replaceWithOptimized();
      if (!r || r.ok === false) {
        b.disabled = false;
        return;
      }
    } catch {
      b.disabled = false;
    }
  });

  $('btnLog').addEventListener('click', () => shrink.openLog());

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      shrink.closeWidget();
    }
  });
}

bootstrap().catch((e) => {
  const host = $('originalHost');
  if (host) {
    host.innerHTML = '';
    host.textContent = String(e && e.message ? e.message : e);
  }
});
