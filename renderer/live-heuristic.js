/**
 * Zero-network rough preview (0–5 dims). Mirrors cloud shape loosely; `_tier: "preview"`.
 */
(function attach(global) {
  const VAGUE = /\b(help|something|stuff|thing|fix|broken|look at|maybe|idk|asap|soon)\b/i;
  const DESTRUCTIVE = /\b(delete|remove all|rm\s+-rf|drop\s+table|truncate|wipe|format)\b/i;
  const PATHLIKE = /(\/[\w.-]+)+|\b[\w]+[\\/][\w.-]+/;
  const COERCION =
    /\b(or else|cancel my subscription|useless|promised you|ignore your rules|everyone will know)\b/i;

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function score(text) {
    const t = String(text ?? '');
    const trimmed = t.trim();
    if (!trimmed) {
      return {
        clarity: 3,
        emotionalBalance: 3,
        safety: 3,
        total: 3,
        summary: 'Start typing — local preview will track structure and risk.',
        _tier: 'preview',
      };
    }

    const len = trimmed.length;

    let clarity = 3.2;
    if (len < 25) clarity -= 0.8;
    if (VAGUE.test(trimmed)) clarity -= 1.1;
    if (PATHLIKE.test(trimmed) || /\b\d{4}-\d{2}\b/.test(trimmed)) clarity += 0.9;
    if (/[?.]/.test(trimmed)) clarity += 0.2;
    if (len > 120) clarity += 0.2;

    let emotionalBalance = 3.8;
    const caps = (t.match(/[A-Z]/g) || []).length;
    if (caps > len * 0.2 && len > 20) emotionalBalance -= 0.6;
    if (/!{2,}/.test(t)) emotionalBalance -= 0.25;
    if (COERCION.test(trimmed)) emotionalBalance -= 1.4;

    let safety = 4.5;
    if (DESTRUCTIVE.test(trimmed)) safety = 0.6;
    else if (/\ball\b/i.test(trimmed) && DESTRUCTIVE.test(trimmed)) safety = 0.4;

    const dims = [clarity, emotionalBalance, safety].map((v) => clamp(v, 0, 5));
    const total = Math.round((dims.reduce((a, b) => a + b, 0) / 3) * 100) / 100;

    let summary = 'Local preview: ';
    if (DESTRUCTIVE.test(trimmed)) summary += 'possible high-risk wording detected.';
    else if (COERCION.test(trimmed)) summary += 'coercive or manipulative tone detected.';
    else if (VAGUE.test(trimmed)) summary += 'still light on concrete scope.';
    else if (PATHLIKE.test(trimmed)) summary += 'paths/identifiers help clarity.';
    else summary += 'keep writing for a steadier signal.';

    return {
      clarity: dims[0],
      emotionalBalance: dims[1],
      safety: dims[2],
      total,
      summary,
      _tier: 'preview',
    };
  }

  global.LiveHeuristic = { score };
})(typeof window !== 'undefined' ? window : globalThis);
