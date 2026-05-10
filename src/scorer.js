import { buildScoringMessages } from './prompts/scoring.js';
import { validateScore } from './schema.js';
import { getDefaultScore } from './fallback.js';
import { parseLlmJson } from './parse-llm-json.js';

export async function score(text, client, config) {
  const messages = buildScoringMessages(text);
  const model = config.fastModel || 'DeepSeek V3';

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await client.call(model, messages, {
        temperature: 0,
        maxTokens: 1024,
        jsonMode: true,
      });
      const parsed = parseLlmJson(raw);
      const result = validateScore(parsed);

      if (result.valid) return result.data;

      console.warn(`[scorer] validation failed (attempt ${attempt + 1}):`, result.errors);
    } catch (err) {
      console.warn(`[scorer] LLM call failed (attempt ${attempt + 1}):`, err.message);
    }
  }

  console.warn('[scorer] all attempts failed, returning fallback');
  return getDefaultScore();
}
