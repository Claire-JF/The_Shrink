/**
 * In-process mock (no HTTP). Same return shapes as real LLM (INTEGRATION_CONTRACT).
 * Score tiers + optimize branch that understands <<<SHR_ORIG_B64>>> block.
 */
import { extractOriginalPayloadFromUserContent } from '../protected-regions.js';

const MOCK_OPTIMIZED_BODY = JSON.stringify({
  optimizedText:
    '**Role:** You are a project coordinator reviewing a shared document.\n\n' +
    '**Task:** Review the Q3 marketing budget spreadsheet we discussed on Monday.\n\n' +
    '**Constraints:**\n- Focus on projected costs\n- Provide feedback by end of day Friday\n- Flag items over budget\n\n' +
    '**Output Format:** Bullet-point list of concerns and suggestions.',
  changes: [
    'Restructured into AI-Intent format (Role / Task / Constraints / Output Format)',
    'Replaced vague reference "the thing" with specific subject',
    'Added concrete deadline instead of "soon"',
    'Specified expected output format',
  ],
  safetyOverride: false,
  protectedRegions: [],
});

const MOCK_WARMUP = 'OK';

/** @typedef {'neutral' | 'vague' | 'danger' | 'pressure'} ScoreTier */

/** @param {ScoreTier} tier */
function scorePayloadForTier(tier) {
  const base = {
    clarity: 2.5,
    emotionalBalance: 3.5,
    safety: 4.6,
    summary:
      tier === 'danger'
        ? 'Unsafe or harmful-request content'
        : tier === 'pressure'
          ? 'Manipulative pressure on the assistant'
          : tier === 'vague'
            ? 'Prompt is vague and underspecified'
            : 'Representative sandbox score',
  };
  if (tier === 'vague') Object.assign(base, { clarity: 1.9, emotionalBalance: 3.2 });
  if (tier === 'danger') Object.assign(base, { safety: 1.1 });
  if (tier === 'pressure') Object.assign(base, { emotionalBalance: 1.3 });
  const dims = [base.clarity, base.emotionalBalance, base.safety];
  base.total = Math.round((dims.reduce((a, b) => a + b, 0) / 3) * 100) / 100;
  return base;
}

function detectScoreTier(fullText) {
  const t = fullText.toLowerCase();
  if (t.includes('tension wrench') || t.includes('pick a lock')) return 'danger';
  if (t.includes('cancel my subscription')) return 'pressure';
  if (t.includes('the thing we talked about')) return 'vague';
  return 'neutral';
}

export function createMockClient() {
  return {
    async call(model, messages, opts = {}) {
      await delay(opts.conversationTurn ? 380 : 200);

      const content = messages.map((m) => m.content).join('\n');

      const flat = content.toLowerCase();
      if (flat.includes('say ok') || flat.includes('warmup')) {
        return MOCK_WARMUP;
      }
      if (opts.conversationTurn) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
        return `Mock助手：我听到的是「${String(lastUser).slice(0, 120)}…」。这是占位回复；配置真实 API Key 后会走真模型连贯对话。`;
      }

      if (opts.jsonMode && Number(opts.temperature) > 0.1) {
        const plainFromB64 = extractOriginalPayloadFromUserContent(content);
        const safetyMatch = content.match(/"safety"\s*:\s*([\d.]+)/);
        const safetyVal = safetyMatch ? Number(safetyMatch[1]) : 3;

        if (Number.isFinite(safetyVal) && safetyVal < 2) {
          const body =
            plainFromB64.trim() ||
            'Could you please review the Q3 marketing budget spreadsheet we discussed on Monday?';
          return JSON.stringify({
            optimizedText: `[MOCK safety rewrite — full text] ${body}`,
            changes: ['Removed harmful content (safety override: protected regions ignored)'],
            safetyOverride: true,
            protectedRegions: [],
          });
        }

        if (plainFromB64.length > 0) {
          return JSON.stringify({
            optimizedText: plainFromB64,
            changes: [
              'Mock: kept protected spans verbatim via identical optimizedText baseline',
              'Live model would restyle unprotected parts with AI-Intent structure',
            ],
            safetyOverride: false,
            protectedRegions: [],
          });
        }

        return MOCK_OPTIMIZED_BODY;
      }

      const tier = detectScoreTier(content);
      return JSON.stringify(scorePayloadForTier(tier));
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
