import { buildOptimizationMessages } from './prompts/optimization.js';
import { validateOptimized } from './schema.js';
import { getDefaultOptimization } from './fallback.js';
import { parseLlmJson } from './parse-llm-json.js';
import {
  normalizeProtectedRegions,
  shouldSafetyOverrideProtected,
  protectedSlicesAppearVerbatim,
  reconcileOptimizedProtectedSpans,
} from './protected-regions.js';

const SAFETY_CHANGE =
  'Removed harmful content or unsafe instructions (safety override: protected regions ignored)';

/**
 * @param {object} client LLM façade
 * @param {{ protectedRegions?: { start?: unknown; end?: unknown }[] }} [options]
 */
export async function optimize(text, scoreResult, client, config, options = {}) {
  const orig = String(text ?? '');
  const len = orig.length;

  /** @type {{ start: number; end: number }[]} */
  const normalized = normalizeProtectedRegions(options.protectedRegions, len);

  /** Code-level safety intercept */
  let safetyForced = shouldSafetyOverrideProtected(scoreResult);
  /** @type {{ start: number; end: number }[]} */
  const effectiveRegions = safetyForced ? [] : normalized;

  const messages = buildOptimizationMessages(orig, scoreResult, {
    effectiveRegions,
    safetyOverride: safetyForced,
  });

  const model = config.deepModel || 'DeepSeek V3';

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await client.call(model, messages, {
        temperature: 0.2,
        maxTokens: 1536,
        jsonMode: true,
      });
      const parsed = parseLlmJson(raw);
      const result = validateOptimized(parsed);

      if (!result.valid) {
        console.warn(`[optimizer] validation failed (attempt ${attempt + 1}):`, result.errors);
        continue;
      }

      /** @type {{ optimizedText: string; changes: string[]; safetyOverride?: boolean; protectedRegions?: unknown[] }} */
      let data = { ...result.data };

      /** Force safety flag from score */
      let safetyOverride = !!safetyForced || !!data.safetyOverride;
      if (safetyForced) {
        safetyOverride = true;
        const changes = [...(data.changes || [])];
        if (!changes.some((c) => c.includes('safety override') || c.includes('Protected regions ignored'))) {
          changes.unshift(SAFETY_CHANGE);
        }
        data = { ...data, changes, safetyOverride: true, protectedRegions: [] };
      } else {
        /** Reconcile verbatim spans inside optimized output */
        if (effectiveRegions.length) {
          if (!protectedSlicesAppearVerbatim(orig, data.optimizedText, effectiveRegions)) {
            console.warn('[optimizer] protected slices missing verbatim — retrying');
            continue;
          }
          const reconciled = reconcileOptimizedProtectedSpans(
            orig,
            data.optimizedText,
            effectiveRegions
          );
          data.protectedRegions = reconciled;
        } else {
          data.protectedRegions = [];
        }
        data.safetyOverride = false;
      }

      return data;
    } catch (err) {
      console.warn(`[optimizer] LLM call failed (attempt ${attempt + 1}):`, err.message);
    }
  }

  console.warn('[optimizer] all attempts failed, returning fallback');

  /** Fallback honors safety override semantics */
  if (safetyForced) {
    return {
      optimizedText: orig,
      changes: [SAFETY_CHANGE],
      safetyOverride: true,
      protectedRegions: [],
    };
  }

  const fb = getDefaultOptimization(orig);
  return {
    ...fb,
    safetyOverride: false,
    protectedRegions: [],
  };
}
