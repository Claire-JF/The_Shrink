export const OPTIMIZATION_SYSTEM_PROMPT = `You are a prompt architect. Transform the user's raw prompt into the most effective format for AI consumption, while respecting spans they marked as protected.

## AI-Intent output pattern (non-protected prose)

Restructure editable parts into this pattern where useful:

1. **Role & Context** — Who should the AI act as? What background does it need?
2. **Task** — One clear sentence for the core request.
3. **Constraints** — Bullet list of requirements, scope, or style.
4. **Output Format** — Expected answer shape (paragraph, list, code, table, etc.).
5. **Examples** (optional) — Surface implicit patterns from the original.

Omit sections that do not apply — avoid boilerplate.

## User score JSON (always inspect)

The user includes a Scores object with five numeric dimensions (0–5): clarity, specificity, safety, tone, actionability. Prefer improving the weakest. Manipulative tone issues map to **Tone** and **Safety**.

## Protected regions (<<PROTECTED>>...<</PROTECTED>>)

The user message may include markers around selected phrases. Rules:

- Copy protected text **verbatim** into optimizedText — no rephrase, translation, or spelling "fixes" inside the marked span.
- Smoothly edit only the **unmarked** text so the full prompt reads well as a whole.
- Keep protected segments in roughly the same order/position relative to the whole.
- If no markers are present (or SAFETY OVERRIDE applies), rewrite freely.

## Rewriting rules

- When **Safety** scores low: remove harmful or irreversible-risk requests; suggest safer alternatives for the legitimate goal.
- When **Tone / actionability** scores low: strip manipulation and add concrete, executable detail.
- Respond with **ONLY** valid JSON matching the keys the user lists (no markdown fences).`;

/**
 * @param {string} text
 * @param {object|null|undefined} scoreResult
 * @param {{ effectiveRegions: { start: number; end: number }[], safetyOverride: boolean }} ctx
 */
export function buildOptimizationMessages(text, scoreResult, ctx = {}) {
  const orig = String(text ?? '');
  const b64 = Buffer.from(orig, 'utf8').toString('base64');
  const effective = ctx.effectiveRegions || [];
  const safetyOverride = !!ctx.safetyOverride;
  const summary = scoreResult && typeof scoreResult.summary === 'string' ? scoreResult.summary : '';

  const markedForModel = applyProtectedMarkers(orig, effective);

  const chunks = [];
  chunks.push(
    'The original UTF-8 string as Base64 (fixtures / verification — must decode to the plain text below).\n' +
      `<<<SHR_ORIG_B64>>>\n${b64}\n<<<SHR_ORIG_END>>>\n`
  );
  chunks.push(`Plain original:\n${orig}\n`);
  chunks.push(
    `Same text with <<PROTECTED>> wrappers on user-selected spans (if any):\n${markedForModel}\n`
  );
  chunks.push(`Scores JSON:\n${JSON.stringify(scoreResult || {})}\n`);
  chunks.push(`Main issue: ${summary}\n`);

  if (safetyOverride) {
    chunks.push(
      'SAFETY OVERRIDE active (safety < 2.0): ignore ALL <<PROTECTED>> regions — rewrite the FULL prompt for safety. Set "safetyOverride": true and "protectedRegions": [].'
    );
  }

  chunks.push(
    'Rewrite weaker areas using the AI-Intent pattern around any protected spans. Return ONLY JSON with keys:\n' +
      '"optimizedText" (string),\n' +
      '"changes" (array of 2–5 strings),\n' +
      '"safetyOverride" (boolean),\n' +
      '"protectedRegions" (array of { "start", "end", "originalText" } for each verbatim protected span in optimizedText, or []).\n' +
      'Do not leave <<PROTECTED>> markers inside optimizedText.'
  );

  return [
    { role: 'system', content: OPTIMIZATION_SYSTEM_PROMPT },
    { role: 'user', content: chunks.join('\n') },
  ];
}

/** @param {{ start: number; end: number }[]} regions */
function applyProtectedMarkers(text, regions) {
  if (!regions || regions.length === 0) return text;

  const sorted = [...regions].sort((a, b) => b.start - a.start);
  let result = text;
  for (const { start, end } of sorted) {
    if (!(end > start)) continue;
    const before = result.slice(0, start);
    const protectedSlice = result.slice(start, end);
    const after = result.slice(end);
    result = `${before}<<PROTECTED>>${protectedSlice}<</PROTECTED>>${after}`;
  }
  return result;
}
