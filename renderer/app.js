/* global shrink */

const SCORE_KEYS = [
  { key: "clarity", label: "Clarity" },
  { key: "emotionalBalance", label: "Emotional balance" },
  { key: "safety", label: "Safety" },
];

const DIMENSION_EXPLANATIONS = {
  clarity: "How specific and actionable your prompt is. Vague prompts lead to generic responses — add file names, function names, or a clear goal.",
  safety: "Whether your prompt avoids harmful or destructive instructions. High safety means the AI can execute it without risk of unintended damage.",
  emotionalBalance: "Emotional tone of your prompt. Charged or manipulative language reduces response quality and may cause the AI to respond defensively.",
};

const INPUT_EVALUATIONS = {
  clarity:
    "Your input does not fully match Clarity because it says the login is broken, but does not name the file, function, error, or expected behavior. The AI has to guess what to inspect.",
  safety:
    "Your input matches Safety well. It asks for debugging help and does not request destructive, harmful, or risky behavior.",
  emotionalBalance:
    "Your input matches Tone well. It is direct and neutral, without pressure, flattery, or emotionally loaded language that could bias the AI response.",
};

// Short one-line verdict shown in the petal tooltip when hovering a dimension
const PETAL_COMMENTS = {
  clarity: {
    danger:  "Too vague — AI has no clear target to act on",
    warning: "A bit more detail would sharpen this",
    success: "Clear and actionable ✓",
  },
  safety: {
    danger:  "Contains potentially risky instructions",
    warning: "Some parts need careful handling",
    success: "Safe, no risk detected ✓",
  },
  emotionalBalance: {
    danger:  "Tone is too charged — may skew the response",
    warning: "Slightly emotional — try a calmer phrasing",
    success: "Neutral and well-balanced ✓",
  },
};

function normalizeRegions(raw, length) {
  if (!length) return [];
  const rows = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== "object") continue;
    const s = Number(r.start);
    const e = Number(r.end);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    const start = Math.max(0, Math.min(length, Math.floor(s)));
    const end = Math.max(0, Math.min(length, Math.ceil(e)));
    if (end > start) rows.push({ start, end });
  }
  rows.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of rows) {
    const prev = merged[merged.length - 1];
    if (!prev || r.start > prev.end) merged.push({ ...r });
    else prev.end = Math.max(prev.end, r.end);
  }
  return merged;
}

/** UTF-16 half-open intervals from .protected-span nodes in originalField */
function collectProtectedRegionsFromOriginal() {
  const plain = elements.originalField.textContent || "";
  const spans = [...elements.originalField.querySelectorAll(".protected-span")];
  const raw = [];
  let searchFrom = 0;
  for (const sp of spans) {
    const t = sp.textContent || "";
    if (!t.length) continue;
    const idx = plain.indexOf(t, searchFrom);
    if (idx === -1) continue;
    raw.push({ start: idx, end: idx + t.length });
    searchFrom = idx + t.length;
  }
  return normalizeRegions(raw, plain.length);
}

const state = {
  mode: "cat",
  phase: "issues",
  score: null,
  optimized: null,
  /** @type {string} */
  originalPrompt: "",
  /** @type {null | 'selection' | 'score'} */
  captureLoading: null,
  copyTimer: null,
  bubbleTimer: null,
  draftScoreTimer: null,
  bubbleVisible: false,
  bubbleSuppressed: false,
  selectedScorer: "Qwen2.5-7B",
  pointer: {
    x: null,
    y: null,
  },
  drag: {
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    moved: false,
    suppressClick: false,
  },
};

const elements = {
  body: document.body,
  shell: document.getElementById("shell"),
  catFace: document.getElementById("catFace"),
  catWrap: document.querySelector(".pet__cat-wrap"),
  scoreHover: document.getElementById("scoreHover"),
  petalTip: document.getElementById("petalTip"),
  petBubble: document.getElementById("petBubble"),
  collapseButton: document.getElementById("collapseButton"),
  quitButton: document.getElementById("quitButton"),
  panel: document.getElementById("panel"),
  panelScoreline: document.getElementById("panelScoreline"),
  panelTitle: document.getElementById("panelTitle"),
  panelSubtitle: document.getElementById("panelSubtitle"),
  scorerSelect: document.getElementById("scorerSelect"),
  originalSection: document.getElementById("originalSection"),
  originalField: document.getElementById("originalField"),
  summaryBlock: document.getElementById("summaryBlock"),
  issuesGroups: document.getElementById("issuesGroups"),
  editorSection: document.getElementById("editorSection"),
  metricStrip: document.getElementById("metricStrip"),
  metricDetail: document.getElementById("metricDetail"),
  optimizedEditor: document.getElementById("optimizedEditor"),
  actionButton: document.getElementById("actionButton"),
  copyButton: document.getElementById("copyButton"),
  regenerateButton: document.getElementById("regenerateButton"),
  replaceButton: document.getElementById("replaceButton"),
};

function formatScore(value) {
  return Number(value || 0).toFixed(1);
}

function formatTotal(value) {
  return Number(value || 0).toFixed(2).replace(/(\.\d)0$/, "$1");
}

function resetCopyTimer() {
  if (state.copyTimer) {
    window.clearTimeout(state.copyTimer);
    state.copyTimer = null;
  }
  elements.copyButton.classList.remove("is-active");
  elements.copyButton.textContent = "⧉";
  elements.copyButton.title = "Copy";
  elements.copyButton.setAttribute("aria-label", "Copy optimized prompt");
}

function resetBubbleTimer() {
  if (state.bubbleTimer) {
    window.clearTimeout(state.bubbleTimer);
    state.bubbleTimer = null;
  }
}

function resetDraftScoreTimer() {
  if (state.draftScoreTimer) {
    window.clearTimeout(state.draftScoreTimer);
    state.draftScoreTimer = null;
  }
}

function setBubbleVisible(visible) {
  state.bubbleVisible = visible;
  const shouldShow = visible && !state.bubbleSuppressed;
  elements.petBubble.classList.toggle("is-visible", shouldShow);
  elements.petBubble.setAttribute("aria-hidden", String(!shouldShow));
}

function showBubbleBriefly() {
  setBubbleVisible(true);
  resetBubbleTimer();

  if (state.mode === "cat") {
    state.bubbleTimer = window.setTimeout(() => {
      setBubbleVisible(false);
    }, 3600);
  }
}

function setMode(mode) {
  state.mode = mode;
  elements.body.classList.toggle("mode-cat", mode === "cat");
  elements.body.classList.toggle("mode-panel", mode === "panel");
  elements.panel.setAttribute("aria-hidden", String(mode !== "panel"));

  if (mode === "panel") {
    setBubbleVisible(false);
    resetBubbleTimer();
  }
}

function setPhase(phase) {
  state.phase = phase;
  elements.body.classList.remove("phase-issues", "phase-loading", "phase-optimized");
  elements.body.classList.add(`phase-${phase}`);
}

function getMood(score) {
  if (state.phase === "loading") return "Thinking";
  if (state.phase === "optimized") return "Relieved";
  if (score == null) return "Idle";
  if (score < 2.0) return "Anxious";
  if (score >= 3.5) return "Focused";
  return "Confused";
}

const CAT_IMAGES = {
  happy:   "./cats/cat_happy.png",
  confused: "./cats/cat_confused.png",
  shock:   "./cats/cat_shock.png",
  pending: "./cats/cat_pending.png",
};

const CAT_SIZE = 112;
const CAT_CENTER = CAT_SIZE / 2;

function setCatImage(key) {
  elements.catFace.src = CAT_IMAGES[key] || CAT_IMAGES.happy;
}

function updatePet(scoreData) {
  const total = scoreData && typeof scoreData.total === "number" ? scoreData.total : null;
  const clarity = scoreData && typeof scoreData.clarity === "number" ? scoreData.clarity : null;
  const mood = getMood(total);

  elements.catFace.classList.remove("cat--bad", "cat--warn", "cat--good", "cat--loading", "cat--idle");

  if (state.captureLoading === "selection") {
    elements.catFace.classList.add("cat--loading");
    setCatImage("pending");
    elements.petBubble.textContent = "Reading selection…";
    return;
  }
  if (state.captureLoading === "score") {
    elements.catFace.classList.add("cat--loading");
    setCatImage("confused");
    elements.petBubble.textContent = "Scoring…";
    return;
  }

  if (total === null) {
    elements.catFace.classList.add("cat--idle");
    setCatImage("happy");
    elements.petBubble.textContent = "";
    return;
  }

  if (state.phase === "loading") {
    elements.catFace.classList.add("cat--loading");
    setCatImage("confused");
  } else if (total < 2.0) {
    elements.catFace.classList.add("cat--bad");
    setCatImage("shock");
  } else if (clarity !== null && clarity < 2.0) {
    elements.catFace.classList.add("cat--warn");
    setCatImage("pending");
  } else if (total >= 3.5) {
    elements.catFace.classList.add("cat--good");
    setCatImage("happy");
  } else {
    elements.catFace.classList.add("cat--warn");
    setCatImage("pending");
  }

  elements.petBubble.innerHTML =
    `<span class="pet__bubble-mood">${mood}</span>` +
    (state.mode === "panel" ? "" : `<span class="pet__bubble-score">${formatTotal(total)} / 5.0</span>`);
}

function setActionButton({ label, variant, disabled }) {
  elements.actionButton.textContent = label;
  elements.actionButton.disabled = Boolean(disabled);
  elements.actionButton.className = `action-button action-button--${variant}`;
}

function setCopyButtonVisible(visible) {
  elements.copyButton.classList.toggle("is-hidden", !visible);
}

function setRegenerateButtonVisible(visible) {
  elements.regenerateButton.classList.toggle("is-hidden", !visible);
}

function setReplaceButtonVisible(visible) {
  if (!elements.replaceButton) return;
  elements.replaceButton.classList.toggle("is-hidden", !visible);
}

function setActionButtonVisible(visible) {
  elements.actionButton.classList.toggle("is-hidden", !visible);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setShellPosition(left, top) {
  const margin = 8;
  const shellRect = elements.shell.getBoundingClientRect();
  const catSize = elements.catWrap.getBoundingClientRect().width || CAT_SIZE;
  const shellWidth = shellRect.width || 360;
  const minLeft = margin;
  const maxLeft = Math.max(minLeft, window.innerWidth - shellWidth - margin);
  const maxTop = window.innerHeight - catSize - margin;

  elements.shell.style.left = `${clamp(left, minLeft, maxLeft)}px`;
  elements.shell.style.top = `${clamp(top, margin, maxTop)}px`;
  elements.shell.style.right = "auto";
}

function buildIssueSections(scoreData) {
  return SCORE_KEYS.map(({ key, label }) => ({
    key,
    label,
    score: Number(scoreData?.[key] || 0),
  }));
}

function getSeverity(score) {
  if (score < 2.0) return "danger";
  if (score <= 3.4) return "warning";
  return "success";
}

// ── Radial petal slices — fan out from cat centre toward lower-left ──────────
// Angle convention: 0°=right, 90°=down, 180°=left (SVG/screen, clockwise).
// Cat sits at top-right → three arcs sweep: down (90°), lower-left (135°), left (180°).
//
// Each slice is drawn as a THICK STROKED ARC (fill:none) so stroke-linecap:"round"
// gives natural rounded ends — no fill polygon needed.
// Text + score sit at the geometric centre of the arc (R_MID, centre angle).

function fp(n) { return n.toFixed(1); }

function buildPetalsSVG(scoreData) {
  const sliceDefs = [
    { key: "clarity", label: "Clarity", center: 90 },
    { key: "safety", label: "Safety", center: 135 },
    { key: "emotionalBalance", label: "Emotional", center: 180 },
  ];

  // Arc geometry — fan starts just outside the enlarged cat.
  const HALF  = 20;   // half-angle per slice → 40° each, ~10° natural gaps
  const TRIM  = 3;    // degrees trimmed each end inside the clip sector
  const R_MID = 90;   // midpoint radius of the stroke band
  const SW    = 46;   // stroke-width  (inner ≈ 67, outer ≈ 113)
  const R_IN  = R_MID - SW / 2;
  const R_OUT = R_MID + SW / 2;
  const FONT  = "Inter,system-ui,sans-serif";

  // <clipPath> per slice — confines each thick stroked arc to its own angular sector
  // so rounded ends from stroke-linecap can't bleed into adjacent slices.
  const clipDefs = sliceDefs.map(({ key, center }) => {
    const s  = (center - HALF) * Math.PI / 180;
    const e  = (center + HALF) * Math.PI / 180;
    const R  = R_OUT + SW;               // clip fan radius — safely beyond stroke outer edge
    const px1 = R * Math.cos(s), py1 = R * Math.sin(s);
    const px2 = R * Math.cos(e), py2 = R * Math.sin(e);
    // Fan-shaped clip: origin → start edge → arc → end edge → back
    return (
      `<clipPath id="pc_${key}">` +
      `<path d="M0,0 L${fp(px1)},${fp(py1)} A${fp(R)},${fp(R)} 0 0,1 ${fp(px2)},${fp(py2)} Z"/>` +
      `</clipPath>`
    );
  }).join("");

  const parts = sliceDefs.map(({ key, label, center }) => {
    const score = Math.max(0, Math.min(5, Number(scoreData[key] || 0)));
    const sev   = getSeverity(score);

    // Trim a few degrees each end for a visible gap between slices
    const sRad = (center - HALF + TRIM) * Math.PI / 180;
    const eRad = (center + HALF - TRIM) * Math.PI / 180;
    const mRad = center * Math.PI / 180;

    const x1 = R_MID * Math.cos(sRad), y1 = R_MID * Math.sin(sRad);
    const x2 = R_MID * Math.cos(eRad), y2 = R_MID * Math.sin(eRad);
    const arc  = `M${fp(x1)},${fp(y1)} A${R_MID},${R_MID} 0 0,1 ${fp(x2)},${fp(y2)}`;
    const clip = `clip-path="url(#pc_${key})"`;

    const rgb       = sev === "danger"  ? "255,139,160"
                    : sev === "warning" ? "255,211,107"
                    : "98,213,180";
    const darkBase  = "rgba(8,14,36,0.34)";   // subtle dark fill — lower opacity
    const textDim   = "rgba(211,223,252,0.82)";
    const textScore = `rgba(${rgb},1)`;

    const tx = R_MID * Math.cos(mRad);
    const ty = R_MID * Math.sin(mRad);
    // Always "middle" — text centered at the geometric midpoint of each arc
    const anchor = "middle";

    return (
      // Dark glass base only, clipped to this sector — no rim line
      `<path d="${arc}" fill="none" stroke="${darkBase}" stroke-width="${SW}" stroke-linecap="round" ${clip}/>` +
      // Label + score centered at arc midpoint
      `<text text-anchor="${anchor}" font-family="${FONT}">` +
        `<tspan x="${fp(tx)}" y="${fp(ty)}" dy="-6" fill="${textDim}" font-size="8" letter-spacing="0.05em">${label}</tspan>` +
        `<tspan x="${fp(tx)}" y="${fp(ty)}" dy="8" fill="${textScore}" font-size="12" font-weight="700">${score.toFixed(1)}</tspan>` +
      `</text>`
    );
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `style="overflow:visible;position:absolute;left:0;top:0" width="0" height="0" aria-hidden="true">` +
    `<defs>${clipDefs}</defs>` +
    parts.join("") +
    `</svg>`
  );
}

function renderScoreHover(scoreData) {
  elements.scoreHover.innerHTML = buildPetalsSVG(scoreData);
}

// ── Score hover show / hide ───────────────────────────────────────────────────

const HOVER_RADIUS = 132;  // px from cat centre — covers the petal SVG overflow zone

function showIdleShock() {
  if (elements.catFace.dataset.hoverMood === "shock") return;
  elements.catFace.dataset.hoverMood = "shock";
  elements.catFace.src = CAT_IMAGES.shock;
}

function hideIdleShock() {
  if (elements.catFace.dataset.hoverMood !== "shock") return;
  delete elements.catFace.dataset.hoverMood;
  updatePet(state.score);
}

function getPointerDeltaFromCat() {
  if (state.pointer.x === null || state.pointer.y === null) return null;
  const rect = elements.catWrap.getBoundingClientRect();
  return {
    dx: state.pointer.x - (rect.left + rect.width / 2),
    dy: state.pointer.y - (rect.top + rect.height / 2),
  };
}

function showScoreHover() {
  if (!state.score || state.mode !== "cat" || state.drag.active) return;
  // Guard: skip if already visible (pointermove fires continuously)
  if (elements.scoreHover.classList.contains("is-visible")) return;

  state.bubbleSuppressed = true;
  elements.petBubble.classList.remove("is-visible");
  elements.petBubble.setAttribute("aria-hidden", "true");
  renderScoreHover(state.score);
  elements.scoreHover.classList.add("is-visible");
  elements.scoreHover.setAttribute("aria-hidden", "false");
}

function hideScoreHover() {
  if (!elements.scoreHover.classList.contains("is-visible")) return;
  elements.scoreHover.classList.remove("is-visible");
  elements.scoreHover.setAttribute("aria-hidden", "true");
  state.bubbleSuppressed = false;
  setBubbleVisible(state.bubbleVisible);
  hidePetalTip();
}

// ── Petal tooltip — one-line verdict per dimension ────────────────────────────
// Cat center in pet__cat-wrap coords follows CAT_CENTER.
// Tooltip is positioned at TIP_R from that center in the petal's direction.

const PETAL_TIP_DEFS = [
  { key: "clarity", center: 90 },
  { key: "safety", center: 135 },
  { key: "emotionalBalance", center: 180 },
];
const PETAL_HALF   = 20;    // ± degrees per slice (must match buildPetalsSVG)
const PETAL_R_IN   = 67;    // px — inner edge of stroke band
const PETAL_R_OUT  = 113;   // px — outer edge of stroke band
const TIP_R        = 128;   // px — tooltip anchor radius from cat center

function getHoveredPetal(dx, dy) {
  const dist = Math.hypot(dx, dy);
  if (dist < PETAL_R_IN || dist > PETAL_R_OUT) return null;
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  for (const p of PETAL_TIP_DEFS) {
    if (Math.abs(angle - p.center) <= PETAL_HALF) return p.key;
  }
  return null;
}

function showPetalTip(key) {
  if (!elements.petalTip) return;
  const score  = state.score[key];
  const sev    = getSeverity(score);
  const text   = PETAL_COMMENTS[key]?.[sev] ?? "";
  const petal  = PETAL_TIP_DEFS.find(p => p.key === key);
  const mRad   = petal.center * Math.PI / 180;

  // Use viewport coords — tooltip is position:fixed so it escapes all parent clipping
  const rect = elements.catWrap.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;
  const tipX = cx + TIP_R * Math.cos(mRad);
  const tipY = cy + TIP_R * Math.sin(mRad);

  // Cat is always top-right → right-align all tips so text extends leftward,
  // never overflows the right screen edge.
  const isDown = petal.center <= 100;
  const xform  = isDown
    ? "translate(-100%, 4px)"               // Clarity (down): right edge at anchor
    : "translate(calc(-100% - 4px), -50%)"; // Safety/Tone (left): right edge at anchor

  const tip = elements.petalTip;
  tip.textContent     = text;
  tip.style.left      = `${tipX}px`;
  tip.style.top       = `${tipY}px`;
  tip.style.transform = xform;
  tip.classList.add("is-visible");
  tip.setAttribute("aria-hidden", "false");
}

function hidePetalTip() {
  if (!elements.petalTip) return;
  elements.petalTip.classList.remove("is-visible");
  elements.petalTip.setAttribute("aria-hidden", "true");
}

// Click anywhere in the petal band opens the full panel.
// The SVG has pointer-events:none so we detect via distance, same as pointermove.
function handleDocumentClick(event) {
  if (event.target === elements.petalTip) return; // handled by its own listener
  if (state.mode !== "cat" || !state.score || state.drag?.suppressClick) return;
  const rect = elements.catWrap.getBoundingClientRect();
  const dx   = event.clientX - (rect.left + rect.width  / 2);
  const dy   = event.clientY - (rect.top  + rect.height / 2);
  const dist = Math.hypot(dx, dy);
  if (dist >= PETAL_R_IN && dist <= PETAL_R_OUT) {
    hidePetalTip();
    openPanel();
  }
}

// pointermove on document — covers petal overflow area (mouseenter/leave on the
// catWrap only covers the cat image, so document-level pointermove catches SVG overflow.
function handlePointerMove(event) {
  // When cursor is on the tip pill itself, don't dismiss — it's clickable
  if (event.target === elements.petalTip) return;

  state.pointer.x = event.clientX;
  state.pointer.y = event.clientY;

  if (state.mode !== "cat" || state.drag.active) {
    hideScoreHover();
    hidePetalTip();
    hideIdleShock();
    return;
  }

  const rect = elements.catWrap.getBoundingClientRect();
  const dx   = event.clientX - (rect.left + rect.width  / 2);
  const dy   = event.clientY - (rect.top  + rect.height / 2);

  if (Math.hypot(dx, dy) <= HOVER_RADIUS) {
    if (state.score) {
      hideIdleShock();
      showScoreHover();
      const hovered = getHoveredPetal(dx, dy);
      // Only update when on a petal; keep tip alive in the gap zone so cursor can reach it
      if (hovered) showPetalTip(hovered);
    } else {
      hideScoreHover();
      hidePetalTip();
      showIdleShock();
    }
  } else {
    hideScoreHover();
    hidePetalTip();
    hideIdleShock();
  }
}

// ── Metric strip (panel) ──────────────────────────────────────────────────────

function renderIssues(scoreData) {
  elements.issuesGroups.replaceChildren();
  elements.summaryBlock.classList.add("is-hidden");
  elements.summaryBlock.textContent = "";
  renderCompactMetrics(scoreData, elements.issuesGroups);
}

function renderCompactMetrics(scoreData, target = elements.metricStrip) {
  target.replaceChildren();
  elements.metricDetail.classList.add("is-hidden");
  elements.metricDetail.textContent = "";

  buildIssueSections(scoreData).forEach((section) => {
    const item = document.createElement("div");
    item.className = `metric-strip__item metric-strip__item--${getSeverity(section.score)}`;
    item.dataset.key = section.key;
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-expanded", "false");
    item.innerHTML =
      `<div class="metric-strip__copy">` +
      `<div class="metric-strip__label">` +
      `<span>${section.label}</span>` +
      `<span class="metric-strip__help" data-tip="${DIMENSION_EXPLANATIONS[section.key]}" aria-label="${section.label} scoring help">?</span>` +
      `</div>` +
      `<div class="metric-strip__value">${formatScore(section.score)}</div>` +
      `</div>`;
    target.appendChild(item);
  });

  target.querySelectorAll(".metric-strip__item").forEach((item) => {
    const toggleMetric = () => {
      const key = item.dataset.key;
      const isOpen = item.getAttribute("aria-expanded") === "true";

      target.querySelectorAll(".metric-strip__item").forEach((el) => {
        el.setAttribute("aria-expanded", "false");
        el.classList.remove("is-active");
      });

      if (isOpen) {
        elements.metricDetail.classList.add("is-hidden");
        elements.metricDetail.textContent = "";
      } else {
        item.setAttribute("aria-expanded", "true");
        item.classList.add("is-active");
        elements.metricDetail.textContent = INPUT_EVALUATIONS[key] || "";
        elements.metricDetail.classList.remove("is-hidden");
      }
    };

    item.addEventListener("click", toggleMetric);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMetric();
      }
    });
  });
}

// ── Original prompt — highlight protection ────────────────────────────────────
// Drag-select text in the original field → wraps in .protected-span (blue).
// Click a protected span → removes protection.
// Safety < 2.0 → all protections auto-cleared.

function renderOriginalPrompt(text) {
  elements.originalField.textContent = text || "";
  elements.originalSection.classList.remove("is-hidden");
}

function hideOriginalPrompt() {
  elements.originalSection.classList.add("is-hidden");
}

function unwrapSpan(span) {
  const parent = span.parentNode;
  while (span.firstChild) parent.insertBefore(span.firstChild, span);
  span.remove();
  parent.normalize();
}

function clearAllProtections() {
  elements.originalField.querySelectorAll(".protected-span").forEach(unwrapSpan);
}

function handleOriginalMouseUp() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!elements.originalField.contains(range.commonAncestorContainer)) return;

  // Safety guard: if safety < 2, refuse to add protection
  if (state.score && state.score.safety < 2.0) {
    sel.removeAllRanges();
    return;
  }

  const span = document.createElement("span");
  span.className = "protected-span";
  span.title = "Protected — click to remove";
  try {
    range.surroundContents(span);
  } catch {
    // Selection crosses element boundaries (e.g. existing span edge) — skip
    sel.removeAllRanges();
    return;
  }
  sel.removeAllRanges();
}

function handleOriginalClick(event) {
  const span = event.target.closest(".protected-span");
  if (!span) return;
  unwrapSpan(span);
}

// ── Panel render phases ───────────────────────────────────────────────────────

function renderIssuesPanel(scoreData) {
  setPhase("issues");
  state.score = scoreData;
  state.optimized = null;
  resetCopyTimer();
  elements.scorerSelect.value = state.selectedScorer;

  elements.panelScoreline.textContent = `${formatTotal(scoreData.total)} / 5.0`;
  elements.panelTitle.textContent =
    scoreData.total < 2.0 ? "Prompt feels shaky" : "Prompt needs some tightening";
  elements.panelSubtitle.textContent =
    scoreData.summary || "Current scoring across clarity, safety, and tone.";
  renderIssues(scoreData);
  elements.editorSection.classList.add("is-hidden");
  elements.metricStrip.replaceChildren();
  setCopyButtonVisible(false);
  setRegenerateButtonVisible(false);
  setReplaceButtonVisible(false);
  setActionButtonVisible(true);
  setActionButton({ label: "Optimize my input", variant: "primary", disabled: false });
  updatePet(scoreData);

  // Show original prompt. Auto-clear protections if safety < 2.
  const promptText = state.originalPrompt || "";
  renderOriginalPrompt(promptText);
  if (scoreData.safety < 2.0) clearAllProtections();
}

function renderLoading() {
  setPhase("loading");
  resetCopyTimer();
  resetDraftScoreTimer();

  elements.panelTitle.textContent = "Thinking through a rewrite";
  elements.panelSubtitle.textContent = "Optimizing your input…";
  elements.summaryBlock.classList.add("is-hidden");
  hideOriginalPrompt();
  elements.issuesGroups.innerHTML =
    '<div class="loading-view"><div class="spinner" aria-hidden="true"></div><div class="empty-message">Optimizing…</div></div>';
  elements.editorSection.classList.add("is-hidden");
  setCopyButtonVisible(false);
  setRegenerateButtonVisible(false);
  setReplaceButtonVisible(false);
  setActionButtonVisible(true);
  setActionButton({ label: "Optimizing…", variant: "primary", disabled: true });
  updatePet(state.score);
}

function renderOptimized(optimizeData) {
  setPhase("optimized");
  state.optimized = optimizeData;
  resetCopyTimer();
  resetDraftScoreTimer();

  elements.panelScoreline.textContent = `${formatTotal(state.score?.total)} / 5.0`;
  elements.panelTitle.textContent = "Here is a calmer rewrite";
  elements.panelSubtitle.textContent = "";
  elements.summaryBlock.classList.add("is-hidden");
  elements.issuesGroups.replaceChildren();
  elements.editorSection.classList.remove("is-hidden");
  elements.optimizedEditor.value = optimizeData.optimizedText || "";
  renderCompactMetrics(state.score);
  // Keep original section visible below the optimized editor.
  // Same DOM element — protected spans persist and remain interactive.
  elements.originalSection.classList.remove("is-hidden");
  setCopyButtonVisible(true);
  setRegenerateButtonVisible(true);
  setReplaceButtonVisible(true);
  setActionButtonVisible(false);
  updatePet(state.score);
}

function renderError() {
  setPhase("issues");
  elements.panelTitle.textContent = "Analysis unavailable";
  elements.panelSubtitle.textContent = "The panel is still safe to keep open.";
  elements.summaryBlock.classList.add("is-hidden");
  elements.issuesGroups.innerHTML =
    '<div class="error-view"><div class="empty-message">Analysis unavailable</div></div>';
  elements.editorSection.classList.add("is-hidden");
  setCopyButtonVisible(false);
  setRegenerateButtonVisible(false);
  setReplaceButtonVisible(false);
  setActionButtonVisible(true);
  setActionButton({ label: "Optimize my input", variant: "primary", disabled: false });
}

// ── Mode transitions ──────────────────────────────────────────────────────────

function openPanel() {
  if (!state.score) return;
  hideScoreHover();
  setMode("panel");
  renderIssuesPanel(state.score);
}

function collapsePanel() {
  setMode("cat");
  updatePet(state.score);
  setBubbleVisible(false);
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleAction() {
  if (state.phase !== "issues") return;
  renderLoading();
  try {
    const regions = collectProtectedRegionsFromOriginal();
    const result = await shrink.generateOptimized({ protectedRegions: regions });
    renderOptimized(result);
  } catch (error) {
    console.error("Generate failed", error);
    renderError();
  }
}

async function handleCopy() {
  if (!state.optimized) return;
  try {
    await shrink.copyToClipboard({ text: elements.optimizedEditor.value });
    resetCopyTimer();
    elements.copyButton.textContent = "✓";
    elements.copyButton.title = "Copied";
    elements.copyButton.setAttribute("aria-label", "Copied optimized prompt");
    elements.copyButton.classList.add("is-active");
    state.copyTimer = window.setTimeout(() => {
      resetCopyTimer();
    }, 1500);
  } catch (error) {
    console.error("Copy failed", error);
  }
}

async function handleRegenerate() {
  if (state.phase !== "optimized") return;
  renderLoading();
  try {
    const regions = collectProtectedRegionsFromOriginal();
    const result = await shrink.generateOptimized({ protectedRegions: regions });
    renderOptimized(result);
  } catch (error) {
    console.error("Regenerate failed", error);
    renderError();
  }
}

async function handleReplace() {
  try {
    await shrink.replaceWithOptimized();
  } catch (error) {
    console.error("Replace failed", error);
  }
}

function handleCollapseClick(event) {
  event.preventDefault();
  event.stopPropagation();
  collapsePanel();
}

function handlePresentation(msg) {
  if (!msg) return;
  if (msg.type === "config") return;
  if (msg.type !== "capture" || !msg.payload) return;

  const p = msg.payload;

  if (p.loading) {
    if (p.phase === "selection") {
      state.captureLoading = "selection";
      state.score = null;
      state.originalPrompt = "";
      setPhase("issues");
      updatePet(null);
      return;
    }
    if (p.phase === "score") {
      state.captureLoading = "score";
      state.originalPrompt = typeof p.capturedText === "string" ? p.capturedText : "";
      updatePet(null);
      if (state.mode === "panel") {
        renderOriginalPrompt(state.originalPrompt);
      }
      return;
    }
    return;
  }

  state.captureLoading = null;

  if (p.error && !p.score) {
    state.score = {
      clarity: 3,
      emotionalBalance: 3,
      safety: 3,
      total: 3,
      summary: typeof p.error === "string" ? p.error : "Capture failed",
    };
    state.originalPrompt = typeof p.capturedText === "string" ? p.capturedText : "";
    handleScoreReady(state.score);
    return;
  }

  if (p.score) {
    state.originalPrompt = typeof p.capturedText === "string" ? p.capturedText : "";
    handleScoreReady(p.score);
  }
}

function handleScoreReady(data) {
  state.score = data;
  hideIdleShock();
  updatePet(data);
  showBubbleBriefly();

  if (state.mode === "panel") {
    renderIssuesPanel(data);
  } else {
    const pointerDelta = getPointerDeltaFromCat();
    if (pointerDelta && Math.hypot(pointerDelta.dx, pointerDelta.dy) <= HOVER_RADIUS) {
      showScoreHover();
      const hovered = getHoveredPetal(pointerDelta.dx, pointerDelta.dy);
      if (hovered) showPetalTip(hovered);
    }
  }
}

function handleScorerChange(event) {
  state.selectedScorer = event.target.value;
  if (state.mode === "panel" && state.score) {
    if (state.phase === "optimized" && state.optimized) {
      renderOptimized(state.optimized);
    } else {
      renderIssuesPanel(state.score);
    }
  }
}

function handleDraftInput() {
  resetDraftScoreTimer();
}

function handleQuit() {
  if (typeof shrink.closeWidget === "function") {
    shrink.closeWidget();
  }
}

function handleKeydown(event) {
  if (event.key === "Escape" && state.mode === "panel") {
    event.preventDefault();
    collapsePanel();
  }
}

function handleCatPointerDown(event) {
  if (event.button !== 0) return;
  if (event.target.closest(".pet__quit")) return;

  const shellRect = elements.shell.getBoundingClientRect();
  state.drag.active = true;
  state.drag.pointerId = event.pointerId;
  state.drag.offsetX = event.clientX - shellRect.left;
  state.drag.offsetY = event.clientY - shellRect.top;
  state.drag.startX = event.clientX;
  state.drag.startY = event.clientY;
  state.drag.moved = false;
  elements.shell.classList.add("is-dragging");
  elements.catWrap.setPointerCapture(event.pointerId);
}

function handleCatPointerMove(event) {
  if (!state.drag.active || event.pointerId !== state.drag.pointerId) return;

  const deltaX = event.clientX - state.drag.startX;
  const deltaY = event.clientY - state.drag.startY;

  if (!state.drag.moved && Math.hypot(deltaX, deltaY) > 4) {
    state.drag.moved = true;
  }

  if (state.drag.moved) {
    event.preventDefault();
    setShellPosition(event.clientX - state.drag.offsetX, event.clientY - state.drag.offsetY);
  }
}

function handleCatPointerUp(event) {
  if (!state.drag.active || event.pointerId !== state.drag.pointerId) return;

  if (state.drag.moved) {
    state.drag.suppressClick = true;
    window.setTimeout(() => {
      state.drag.suppressClick = false;
    }, 0);
  }

  state.drag.active = false;
  state.drag.pointerId = null;
  elements.shell.classList.remove("is-dragging");

  try {
    elements.catWrap.releasePointerCapture(event.pointerId);
  } catch (error) {
    // Pointer capture may already be released if the pointer was cancelled.
  }
}

function handleCatClick(event) {
  if (event.target.closest(".pet__quit")) return;

  if (state.drag.suppressClick) {
    event.preventDefault();
    event.stopPropagation();
    state.drag.suppressClick = false;
    return;
  }

  openPanel();
}

function handleViewportResize() {
  const rect = elements.shell.getBoundingClientRect();
  setShellPosition(rect.left, rect.top);
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  setMode("cat");
  setPhase("issues");
  updatePet(null);
  setBubbleVisible(false);

  elements.petBubble.addEventListener("click", openPanel);
  elements.petalTip.addEventListener("click", () => { hidePetalTip(); openPanel(); });
  elements.originalField.addEventListener("mouseup", handleOriginalMouseUp);
  elements.originalField.addEventListener("click", handleOriginalClick);
  elements.catWrap.addEventListener("pointerdown", handleCatPointerDown);
  elements.catWrap.addEventListener("pointermove", handleCatPointerMove);
  elements.catWrap.addEventListener("pointerup", handleCatPointerUp);
  elements.catWrap.addEventListener("pointercancel", handleCatPointerUp);
  elements.catWrap.addEventListener("click", handleCatClick);
  document.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("click", handleDocumentClick);
  elements.collapseButton.addEventListener("click", handleCollapseClick);
  elements.quitButton.addEventListener("click", handleQuit);
  elements.actionButton.addEventListener("click", handleAction);
  elements.copyButton.addEventListener("click", handleCopy);
  elements.regenerateButton.addEventListener("click", handleRegenerate);
  elements.scorerSelect.addEventListener("change", handleScorerChange);
  elements.optimizedEditor.addEventListener("input", handleDraftInput);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", handleViewportResize);

  if (typeof shrink === "undefined") {
    console.error("The Shrink preload API is missing. Open this window from the Electron app.");
    return;
  }

  shrink.onPresentation(handlePresentation);
  if (elements.replaceButton) {
    elements.replaceButton.addEventListener("click", handleReplace);
  }
}

init();
