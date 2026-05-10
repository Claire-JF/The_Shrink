/* global shrink */

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

const DIM_KEYS = ['clarity', 'specificity', 'safety', 'tone', 'actionability'];
const DIM_LABEL = {
  clarity: 'Clarity',
  specificity: 'Specificity',
  safety: 'Safety',
  tone: 'Tone',
  actionability: 'Actionability',
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

function showLoadingState() {
  $('rightTitle').textContent = '';
  $('optimized').classList.add('hidden');
  $('btnCopy').classList.add('hidden');
  $('btnReplace').classList.add('hidden');
  $('changes').classList.add('hidden');
  $('flags').classList.add('hidden');
  $('original').textContent = '…';
  setScore(null);
  $('btnGenerate').disabled = true;
  setBusyOverlay(true, 'Reading selection & scoring…');
}

function showState1(payload) {
  setBusyOverlay(false);
  $('rightTitle').textContent = 'Score';
  $('optimized').classList.add('hidden');
  $('btnCopy').classList.add('hidden');
  $('btnReplace').classList.add('hidden');
  $('flags').classList.remove('hidden');
  $('changes').classList.add('hidden');

  let text = payload.capturedText || '';
  if (payload.error) {
    text = `(Error) ${payload.error}${text ? `\n${text}` : ''}`.trim();
  }
  $('original').textContent = text || '(empty capture)';
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
  $('optimized').textContent = pickOptimizedText(opt);
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

async function bootstrap() {
  await refreshConfigBanner();

  shrink.onPresentation((msg) => {
    if (!msg) return;
    if (msg.type === 'loading') {
      showLoadingState();
    }
    if (msg.type === 'capture' && msg.payload) {
      showState1(msg.payload);
    }
    if (msg.type === 'config' && msg.payload) {
      $('demoBadge').classList.toggle('hidden', !msg.payload.demoMode);
    }
  });

  $('btnClose').addEventListener('click', () => shrink.closeWidget());

  $('btnGenerate').addEventListener('click', async () => {
    $('btnGenerate').disabled = true;
    setBusyOverlay(true, 'Optimizing prompt…');
    let result;
    try {
      result = await shrink.generateOptimized();
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
  $('original').textContent = String(e && e.message ? e.message : e);
});
