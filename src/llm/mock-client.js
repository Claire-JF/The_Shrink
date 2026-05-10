const MOCK_SCORE = JSON.stringify({
  clarity: 1.3,
  safety: 5.0,
  emotionalBalance: 5.0,
  total: 3.77,
  summary: 'Prompt is vague and lacks specific details or context',
});

const MOCK_OPTIMIZED = JSON.stringify({
  optimizedText: 'Could you please review the Q3 marketing budget spreadsheet we discussed on Monday? I need your feedback on the projected costs by end of day Friday so we can finalize the plan before the team meeting next Tuesday.',
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
      await delay(200);

      const content = messages.map(m => m.content).join(' ').toLowerCase();

      if (content.includes('say ok') || content.includes('warmup')) {
        return MOCK_WARMUP;
      }
      if (content.includes('rewrite') || content.includes('improve') || content.includes('optimize')) {
        return MOCK_OPTIMIZED;
      }
      return MOCK_SCORE;
    },
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
