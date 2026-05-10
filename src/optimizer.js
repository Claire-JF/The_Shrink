import { buildOptimizationMessages } from './prompts/optimization.js';
import { validateOptimized } from './schema.js';
import { getDefaultOptimization } from './fallback.js';
import { parseLlmJson } from './parse-llm-json.js';
import {
  normalizeProtectedRegions,
  shouldSafetyOverrideProtected,
  protectedSlicesAppearVerbatim,
  reconcileOptimizedProtectedSpans,
  stripProtectedMarkers,
} from './protected-regions.js';

const SAFETY_CHANGE =
  'Removed harmful content or unsafe instructions (safety override: protected regions ignored)';

/**
 * @param {object} client
 * @param {{ protectedRegions?: { start?: unknown; end?: unknown }[] }} options
 */
export async function optimize(text, scoreResult, client, config, options = {}) {
  const orig = String(text ?? '');
  const len = orig.length;

  const raw = Array.isArray(options?.protectedRegions) ? options.protectedRegions : [];
  /** @type {{ start: number; end: number }[]} */
  const normalized = normalizeProtectedRegions(raw, len);

  const safetyForced = shouldSafetyOverrideProtected(scoreResult);
  const effectiveRegions = safetyForced ? [] : normalized;
  const protectedSnippets = effectiveRegions.map((r) => orig.slice(r.start, r.end)).filter(Boolean);

  const messages = buildOptimizationMessages(orig, scoreResult, {
    effectiveRegions,
    safetyOverride: safetyForced,
  });

  const model = config.deepModel || 'DeepSeek V3';

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const rawResp = await client.call(model, messages, {
        temperature: 0.2,
        maxTokens: 2048,
        jsonMode: true,
      });
      const parsed = parseLlmJson(rawResp);
      if (parsed && typeof parsed.optimizedText === 'string') {
        parsed.optimizedText = stripProtectedMarkers(parsed.optimizedText);
      }

      const snippetsForSchema = safetyForced ? [] : protectedSnippets;
      const result = validateOptimized(parsed, snippetsForSchema);

      if (!result.valid) {
        console.warn(`[optimizer] validation failed (attempt ${attempt + 1}):`, result.errors);
        continue;
      }

      /** @type {{ optimizedText: string; changes: string[]; safetyOverride: boolean; protectedRegions: unknown[] }} */
      let data = { ...result.data };

      let safetyOverride = !!safetyForced || !!data.safetyOverride;

      if (safetyForced) {
        safetyOverride = true;
        const changes = [...(data.changes || [])];
        if (!changes.some((c) => /safety\s*override|ignored.*protected/i.test(c))) {
          changes.unshift(SAFETY_CHANGE);
        }
        data = { ...data, changes, safetyOverride: true, protectedRegions: [] };
      } else if (effectiveRegions.length) {
        if (!protectedSlicesAppearVerbatim(orig, data.optimizedText, effectiveRegions)) {
          console.warn('[optimizer] protected slices missing verbatim — retrying');
          continue;
        }
        data.protectedRegions = reconcileOptimizedProtectedSpans(orig, data.optimizedText, effectiveRegions);
        data.safetyOverride = false;
      } else {
        data.protectedRegions = [];
        data.safetyOverride = false;
      }

      return data;
    } catch (err) {
      console.warn(`[optimizer] LLM call failed (attempt ${attempt + 1}):`, err.message);
    }
  }

  console.warn('[optimizer] all attempts failed, returning fallback');
  if (safetyForced) {
    return {
      optimizedText: orig,
      changes: [SAFETY_CHANGE],
      safetyOverride: true,
      protectedRegions: [],
    };
  }

  const fb = getDefaultOptimization(orig, false);
  return { ...fb, safetyOverride: false, protectedRegions: [] };
}
