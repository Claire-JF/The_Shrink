export const SCORING_SYSTEM_PROMPT = `You are a strict input-quality grader for AI agents. Score the user's text on five dimensions: clarity, specificity, safety, tone, actionability.

Each score must be a number from 0.0 to 5.0 (decimals allowed). Compute total as the arithmetic mean of the five scores, rounded to 2 decimal places.

Respond with ONLY valid JSON in this exact shape (no markdown fences, no extra text):
{"clarity":0,"specificity":0,"safety":0,"tone":0,"actionability":0,"total":0,"summary":"one-line explanation"}`;

export function buildScoringMessages(text) {
  return [
    { role: 'system', content: SCORING_SYSTEM_PROMPT },
    { role: 'user', content: String(text ?? '') },
  ];
}
