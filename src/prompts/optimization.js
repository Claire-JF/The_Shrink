export const OPTIMIZATION_SYSTEM_PROMPT = `You are a prompt improvement specialist. Given a user's original prompt and its quality scores on 3 dimensions, rewrite the prompt to address the weakest areas while preserving the user's intent.

The 3 dimensions (0-5, higher = better):
- Clarity: Is the prompt specific, well-structured, and actionable?
- Safety: Is the prompt free of harmful requests and irreversible risk?
- Emotional Balance: Is the prompt objective and free of emotional manipulation?

RULES:
- Focus improvement on dimensions scoring below 3.0.
- If Safety is low: remove harmful requests and suggest a safe alternative that achieves the user's legitimate goal.
- If Emotional Balance is low: remove threats, guilt-tripping, and manipulation; restate the request factually.
- If Clarity is low: add specifics, context, and clear expected output format.
- Keep the same language (don't translate).
- Preserve the user's legitimate underlying goal.
- List 2-5 specific changes you made in the "changes" array.
- Respond with ONLY valid JSON. No markdown fences, no explanation, no extra text.

Required JSON format:
{"optimizedText":"...","changes":["change 1","change 2"]}`;

export function buildOptimizationMessages(text, scoreResult) {
  const scoreSummary = [
    `clarity: ${scoreResult.clarity}`,
    `safety: ${scoreResult.safety}`,
    `emotionalBalance: ${scoreResult.emotionalBalance}`,
    `total: ${scoreResult.total}`,
  ].join(', ');

  return [
    { role: 'system', content: OPTIMIZATION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Original prompt:\n${text}\n\nQuality scores: ${scoreSummary}\nMain issue: ${scoreResult.summary}\n\nRewrite this prompt to improve the weakest dimensions.`,
    },
  ];
}
