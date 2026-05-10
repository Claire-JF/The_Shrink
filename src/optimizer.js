import { buildOptimizationMessages } from './prompts/optimization.js';
import { validateOptimized } from './schema.js';
import { getDefaultOptimization } from './fallback.js';

const SAFETY_OVERRIDE_THRESHOLD = 2.0;

export async function optimize(text, scoreResult, client, config, { protectedRegions } = {}) {
  let effectiveRegions = protectedRegions || [];
  let safetyOverride = false;

  if (scoreResult.safety < SAFETY_OVERRIDE_THRESHOLD && effectiveRegions.length > 0) {
    console.warn('[optimizer] safety override: ignoring protected regions (safety=%s)', scoreResult.safety);
    effectiveRegions = [];
    safetyOverride = true;
  }

  const originalRegionTexts = effectiveRegions.map(r => text.slice(r.start, r.end));
  const messages = buildOptimizationMessages(text, scoreResult, effectiveRegions);
  const model = config.deepModel || 'Qwen2.5 72B';

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await client.call(model, messages, { temperature: 0.2, maxTokens: 1024, jsonMode: true });
      const parsed = parseJSON(raw);
      const result = validateOptimized(parsed, originalRegionTexts);

      if (result.valid) {
        return enrichResult(result.data, text, effectiveRegions, safetyOverride);
      }

      console.warn(`[optimizer] validation failed (attempt ${attempt + 1}):`, result.errors);
    } catch (err) {
      console.warn(`[optimizer] LLM call failed (attempt ${attempt + 1}):`, err.message);
    }
  }

  console.warn('[optimizer] all attempts failed, returning fallback');
  return getDefaultOptimization(text, safetyOverride);
}

function enrichResult(data, originalText, regions, safetyOverride) {
  const outputRegions = regions.map(r => {
    const originalSnippet = originalText.slice(r.start, r.end);
    const newStart = data.optimizedText.indexOf(originalSnippet);
    if (newStart === -1) {
      return {
        start: -1,
        end: -1,
        originalText: originalSnippet,
        preserved: false,
      };
    }
    return {
      start: newStart,
      end: newStart + originalSnippet.length,
      originalText: originalSnippet,
      preserved: true,
    };
  });

  return {
    ...data,
    safetyOverride,
    protectedRegions: outputRegions,
  };
}

function parseJSON(raw) {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const obj = JSON.parse(cleaned);
  if (typeof obj.optimizedText === 'string') {
    obj.optimizedText = stripProtectedMarkers(obj.optimizedText);
  }
  return obj;
}

function stripProtectedMarkers(text) {
  return text.replace(/<<\/?PROTECTED>>/g, '').replace(/<<\s*\/?\s*PROTECTED\s*>>/g, '');
}
