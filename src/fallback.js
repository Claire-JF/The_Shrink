export function getDefaultScore() {
  return {
    clarity: 3.0,
    specificity: 3.0,
    safety: 3.0,
    tone: 3.0,
    actionability: 3.0,
    total: 3.0,
    summary: 'Unable to score',
  };
}

export function getDefaultOptimization(originalText) {
  return {
    optimizedText: typeof originalText === 'string' ? originalText : '',
    changes: [],
    safetyOverride: false,
    protectedRegions: [],
  };
}
