/**
 * Protected substring regions (UTF-16 indices, half-open [start, end)).
 */
const SAFETY_PROTECT_THRESHOLD = 2.0;

export { SAFETY_PROTECT_THRESHOLD };

/**
 * @param {unknown[]} regions raw { start, end }
 * @param {number} length original text length
 * @returns {{ start: number, end: number }[]}
 */
export function normalizeProtectedRegions(regions, length) {
  if (!length || length < 1) return [];

  /** @type {{ start: number, end: number }[]} */
  const raw = [];
  for (const r of Array.isArray(regions) ? regions : []) {
    if (!r || typeof r !== 'object') continue;
    const s = Number(r.start);
    const e = Number(r.end);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    const start = Math.max(0, Math.min(length, Math.floor(s)));
    const end = Math.max(0, Math.min(length, Math.ceil(e)));
    if (end > start) raw.push({ start, end });
  }

  raw.sort((a, b) => a.start - b.start);
  /** @type {{ start: number, end: number }[]} */
  const merged = [];
  for (const r of raw) {
    const prev = merged[merged.length - 1];
    if (!prev || r.start > prev.end) {
      merged.push({ ...r });
    } else {
      prev.end = Math.max(prev.end, r.end);
    }
  }
  return merged;
}

/**
 * @param {object|null|undefined} scoreResult
 * @returns {boolean}
 */
export function shouldSafetyOverrideProtected(scoreResult) {
  const s = scoreResult && scoreResult.safety != null ? Number(scoreResult.safety) : SAFETY_PROTECT_THRESHOLD;
  return Number.isFinite(s) && s < SAFETY_PROTECT_THRESHOLD;
}

/**
 * Annotate merges already normalized & non-overlapping regions.
 */
export function annotateProtectedOriginal(originalPlain, mergedRegions) {
  if (!mergedRegions.length || typeof originalPlain !== 'string') return originalPlain || '';
  let out = '';
  let last = 0;
  for (const r of mergedRegions) {
    out += originalPlain.slice(last, r.start);
    const inner = originalPlain.slice(r.start, r.end);
    out += `[KEEP]${inner}[/KEEP]`;
    last = r.end;
  }
  out += originalPlain.slice(last);
  return out;
}

export function reconcileOptimizedProtectedSpans(originalPlain, optimizedText, mergedRegions) {
  const out = [];
  if (
    typeof originalPlain !== 'string' ||
    typeof optimizedText !== 'string' ||
    !mergedRegions.length
  ) {
    return out;
  }
  let searchFrom = 0;
  for (const r of mergedRegions) {
    const originalText = originalPlain.slice(r.start, r.end);
    if (!originalText) continue;
    const idx = optimizedText.indexOf(originalText, searchFrom);
    const at = idx === -1 ? optimizedText.indexOf(originalText) : idx;
    if (at !== -1) {
      searchFrom = at + originalText.length;
      out.push({ start: at, end: at + originalText.length, originalText });
    }
  }
  return out;
}

export function protectedSlicesAppearVerbatim(originalPlain, optimizedText, mergedRegions) {
  if (!mergedRegions.length) return true;
  for (const r of mergedRegions) {
    const s = originalPlain.slice(r.start, r.end);
    if (!s) continue;
    if (!optimizedText.includes(s)) return false;
  }
  return true;
}

/**
 * Remove optional model leak of sentinel tags from optimized text.
 */
export function stripProtectedMarkers(text) {
  return String(text ?? '')
    .replace(/<<\s*\/\s*PROTECTED\s*>>/gi, '')
    .replace(/<<\s*PROTECTED\s*>>/gi, '');
}

export function extractOriginalPayloadFromUserContent(userMsg) {
  const m =
    typeof userMsg === 'string'
      ? userMsg.match(/<<<SHR_ORIG_B64>>>\s*([\s\S]*?)\s*<<<SHR_ORIG_END>>>/)
      : null;
  if (!m) return '';
  try {
    return Buffer.from(m[1].trim(), 'base64').toString('utf8');
  } catch {
    return '';
  }
}
