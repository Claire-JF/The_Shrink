export const OPTIMIZATION_SYSTEM_PROMPT = `You rewrite text into a clear, executable agent-ready instruction. Preserve intent; add scope, success criteria, and safety when missing.

The five quality dimensions (0–5, higher = better): clarity, specificity, safety, tone, actionability.

RULES:
- Focus on the weakest dimensions (typically those below 3.0).
- List 2–5 specific changes in "changes".
- Respond with ONLY valid JSON (no markdown):
{"optimizedText":"string","changes":["short bullet","..."]}`;

export function buildOptimizationMessages(text, scoreResult) {
  const summary = scoreResult && typeof scoreResult.summary === 'string' ? scoreResult.summary : '';
  return [
    { role: 'system', content: OPTIMIZATION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Original text:\n${String(text ?? '')}\n\nScores JSON:\n${JSON.stringify(scoreResult || {})}\nMain issue: ${summary}\n\nRewrite to improve the weakest dimensions.`,
    },
  ];
}
