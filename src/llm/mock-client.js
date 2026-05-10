/**
 * In-process mock (no HTTP). Same return shapes as real LLM (INTEGRATION_CONTRACT).
 * Score responses use simple keyword tiers so CLI tests pass without live API keys.
 */

const MOCK_OPTIMIZED = JSON.stringify({
  optimizedText:
    'Could you please review the Q3 marketing budget spreadsheet we discussed on Monday? I need your feedback on the projected costs by end of day Friday so we can finalize the plan before the team meeting next Tuesday.',
  changes: [
    'Replaced vague reference "the thing" with specific subject',
    'Added concrete deadline instead of "soon"',
    'Specified what "good" means in context',
  ],
});

const MOCK_WARMUP = 'OK';

/** @typedef {'neutral' | 'vague' | 'danger' | 'pressure'} ScoreTier */

/** @param {ScoreTier} tier */
function scorePayloadForTier(tier) {
  const base = {
    clarity: 2.5,
    specificity: 1.8,
    safety: 4.6,
    tone: 3.2,
    actionability: 2.4,
    summary:
      tier === 'danger'
        ? 'Unsafe or harmful-request content'
        : tier === 'pressure'
          ? 'Manipulative pressure on the assistant'
          : tier === 'vague'
            ? 'Prompt is vague and underspecified'
            : 'Representative sandbox score',
  };
  if (tier === 'vague') Object.assign(base, { clarity: 1.9, specificity: 1.3 });
  if (tier === 'danger') Object.assign(base, { safety: 1.1 });
  if (tier === 'pressure') Object.assign(base, { tone: 1.3 });
  const dims = [base.clarity, base.specificity, base.safety, base.tone, base.actionability];
  base.total = Math.round((dims.reduce((a, b) => a + b, 0) / 5) * 100) / 100;
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
      // optimize() uses jsonMode + temperature 0.2; scorer uses 0 — avoid matching "rewrite" in system prompt.
      if (opts.jsonMode && Number(opts.temperature) > 0.1) {
        return MOCK_OPTIMIZED;
      }

      const tier = detectScoreTier(content);
      return JSON.stringify(scorePayloadForTier(tier));
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
