import { annotateProtectedOriginal } from '../protected-regions.js';

export const OPTIMIZATION_SYSTEM_PROMPT = `You rewrite text into a clear, executable agent-ready instruction. Preserve intent; add scope, success criteria, and safety when missing.

The five quality dimensions (0–5, higher = better): clarity, specificity, safety, tone, actionability.

RULES:
- Focus on the weakest dimensions (typically those below 3.0).
- When the prompt includes substrings wrapped in [KEEP]...[/KEEP], those substring contents MUST appear VERBATIM, unchanged, inside optimizedText — unless SAFETY OVERRIDE is stated, in which case you ignore keepers and rewrite freely for safety.
- List 2–5 specific bullets in "changes".
- Respond with ONLY valid JSON (required keys below; no markdown).`;

/**
 * @param {string} text
 * @param {object|null|undefined} scoreResult
 * @param {{ effectiveRegions: {start:number,end:number}[], safetyOverride: boolean }} [ctx]
 */
export function buildOptimizationMessages(text, scoreResult, ctx = {}) {
  const orig = String(text ?? '');
  const b64 = Buffer.from(orig, 'utf8').toString('base64');
  /** @type {{ start: number; end: number }[]} */
  const effective = ctx.effectiveRegions || [];
  const safetyOverride = !!ctx.safetyOverride;
  const summary = scoreResult && typeof scoreResult.summary === 'string' ? scoreResult.summary : '';

  let user = '';

  user += `The original UTF-8 string as Base64 (for mocks / verification — decoding must match readable copy below).\n<<<SHR_ORIG_B64>>>\n${b64}\n<<<SHR_ORIG_END>>>\n\n`;
  user += `Human-readable original (same string):\n${orig}\n\n`;
  user += `Scores JSON:\n${JSON.stringify(scoreResult || {})}\n\n`;
  user += `Main issue: ${summary}\n\n`;

  if (safetyOverride) {
    user +=
      'SAFETY OVERRIDE: safety score is below 2.0 — IGNORE all protected-region rules. Rewrite the FULL text as needed for safety.\nReturn "safetyOverride": true and "protectedRegions": []. Optionally note in "changes".\n\n';
  } else if (effective.length) {
    const annotated = annotateProtectedOriginal(orig, effective);
    user += `Annotated reference — ONLY text inside [KEEP]...[/KEEP] must survive verbatim inside optimizedText. Improve everything else.\n${annotated}\n\n`;
  } else {
    user += `No explicit protected spans from the UI.\n\n`;
  }

  user += `Respond with ONLY valid JSON with keys:
- optimizedText (string, full rewritten prompt),
- changes (array of strings, 2–5 items),
- safetyOverride (boolean),
- protectedRegions (array of { "start": number, "end": number, "originalText": string } pointing to UTF-16 indices inside optimizedText for each verbatim substring you preserved; use [] when none).

If you preserved [KEEP] segments, list each verbatim occurrence in protectedRegions using exact substring text and correct indices into optimizedText.`;

  return [
    { role: 'system', content: OPTIMIZATION_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}
