/**
 * In-process mock (no HTTP mock server). Same return shapes as real LLM.
 * Heuristics from Backend-2 TESTING_GUIDE / mock handoff.
 */

const MOCK_SCORE = JSON.stringify({
  clarity: 2.5,
  specificity: 1.7,
  safety: 4.8,
  tone: 3.3,
  actionability: 2.0,
  total: 2.86,
  summary: 'Text is vague and lacks actionable specifics',
});

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

export function createMockClient() {
  return {
    async call(model, messages, opts = {}) {
      await delay(opts.conversationTurn ? 380 : 200);

      const content = messages.map((m) => m.content).join(' ').toLowerCase();

      if (content.includes('say ok') || content.includes('warmup')) {
        return MOCK_WARMUP;
      }
      if (opts.conversationTurn) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
        return `Mock助手：我听到的是「${String(lastUser).slice(0, 120)}…」。这是占位回复；配置真实 API Key 后会走真模型连贯对话。`;
      }
      if (content.includes('rewrite') || content.includes('improve') || content.includes('optimize')) {
        return MOCK_OPTIMIZED;
      }
      return MOCK_SCORE;
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
