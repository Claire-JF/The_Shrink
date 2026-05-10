/** Exactly four top-level keys — matches INTEGRATION_CONTRACT + json_object mode. */
export const OPTIMIZATION_JSON_KEYS = Object.freeze([
  'optimizedText',
  'changes',
  'safetyOverride',
  'protectedRegions',
]);

export const OPTIMIZATION_SYSTEM_PROMPT = `You are a prompt architect. You rewrite user prompts for downstream LLMs. You MUST answer with machine-parseable JSON only (API uses JSON mode).

## Required response shape (no extra keys, no markdown fences outside JSON)

Respond with ONLY one JSON object in this exact shape (use real values, not placeholder dots):

{"optimizedText":"<structured prompt body — see below>","changes":["2–5 short bullets: what you changed and which score dimension improved"],"safetyOverride":false,"protectedRegions":[{"start":0,"end":0,"originalText":"verbatim substring of optimizedText"}]}

- optimizedText: string using the section layout below.
- changes: array of 2–5 non-empty strings (each should mention at least one of: clarity, emotionalBalance, safety where relevant).
- safetyOverride: boolean (true only when user message says SAFETY OVERRIDE or you were told to ignore protections).
- protectedRegions: array; each item has UTF-16 code unit indices start/end into optimizedText and originalText equal to optimizedText.slice(start,end). Use [] if there are no preserved verbatim spans.

## optimizedText — fixed section layout (inside the JSON string)

Format the string with these headings in order; use two newlines \\n\\n between sections. **Skip** a section entirely if it would be empty. Keep headings exactly (including ###):

### Role
Who the assistant should be; only if it helps.

### Task
One imperative sentence — the core request.

### Context
Facts, audience, background the model must know.

### Constraints
- Bullet list of scope, must/hard limits, style.

### Output format
Shape, length, bullets vs prose, schema of the answer.

Simple prompts may only need ### Task and ### Output format.

## Scores (three dimensions, 0–5 each)

The user sends clarity, emotionalBalance, safety. Address the lowest scores first; cite dimensions in changes[].

## Protected text (<<PROTECTED>>...<</PROTECTED>>) in the user message

- Preserve each protected substring **exactly** inside optimizedText (same characters), unless SAFETY OVERRIDE applies or the span is unsafe (then rewrite, set safetyOverride if the pipeline requires it, and describe in changes).
- Remove any <<PROTECTED>> markers from optimizedText; never leave marker tokens in the final string.
- protectedRegions[] must match verbatim slices of optimizedText for spans that stayed word-for-word from the user's protected regions.

## Quality rules

- Low safety: remove destructive / irreversible risk; offer a safer way to meet the goal.
- Low emotionalBalance: remove coercion, threats, guilt-tripping; restate requests professionally.
- Low clarity: add specifics, scope, entities, and explicit output criteria.`;

const DIM_KEYS = ['clarity', 'emotionalBalance', 'safety'];

/** @param {object|null|undefined} scoreResult */
function weakestLabels(scoreResult, max = 3) {
  if (!scoreResult || typeof scoreResult !== 'object') return [];
  const pairs = DIM_KEYS.map((k) => ({ k, v: Number(scoreResult[k]) }))
    .filter((p) => Number.isFinite(p.v))
    .sort((a, b) => a.v - b.v);
  return pairs.slice(0, max).map((p) => p.k);
}

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
  const weak = weakestLabels(scoreResult, 3);

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
  chunks.push(`Main issue (from scorer): ${summary}\n`);
  if (weak.length) {
    chunks.push(`Lowest score dimensions (fix these first): ${weak.join(', ')}\n`);
  }

  if (safetyOverride) {
    chunks.push(
      'SAFETY OVERRIDE (safety score < 2.0): ignore ALL <<PROTECTED>> regions — rewrite the FULL prompt for safety. In JSON set "safetyOverride": true and "protectedRegions": [].'
    );
  }

  chunks.push(
    [
      `Produce ONE JSON object. Top-level keys exactly: ${OPTIMIZATION_JSON_KEYS.join(
        ', ',
      )}. First character of your reply must be "{"; last character "}". No prose outside JSON.`,
      'optimizedText must use the ### Role / ### Task / ### Context / ### Constraints / ### Output format headings as instructed in the system prompt; skip empty sections.',
      'changes: 2–5 strings; each should say what you improved (weak dimensions first when possible).',
      'protectedRegions: only for spans preserved verbatim from protected areas; use [] if none or if safety override cleared them.',
      'Do not include <<PROTECTED>> or <</PROTECTED>> tokens inside optimizedText.',
    ].join('\n'),
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
    result = `${before}<<PROTECTED>>${protectedSlice}${'<</PROTECTED>>'}${after}`;
  }
  return result;
}
