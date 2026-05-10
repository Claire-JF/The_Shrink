import { buildOptimizationMessages } from './prompts/optimization.js';
import { validateOptimized } from './schema.js';
import { getDefaultOptimization } from './fallback.js';

export async function optimize(text, scoreResult, client, config) {
  const messages = buildOptimizationMessages(text, scoreResult);
  const model = config.deepModel || 'Qwen2.5 72B';

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await client.call(model, messages, { temperature: 0.2, maxTokens: 1024, jsonMode: true });
      const parsed = parseJSON(raw);
      const result = validateOptimized(parsed);

      if (result.valid) return result.data;

      console.warn(`[optimizer] validation failed (attempt ${attempt + 1}):`, result.errors);
    } catch (err) {
      console.warn(`[optimizer] LLM call failed (attempt ${attempt + 1}):`, err.message);
    }
  }

  console.warn('[optimizer] all attempts failed, returning fallback');
  return getDefaultOptimization(text);
}

function parseJSON(raw) {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  return JSON.parse(cleaned);
}
