export function getDefaultScore() {
  return {
    clarity: 3.0,
    emotionalBalance: 3.0,
    safety: 3.0,
    total: 3.0,
    summary: 'Unable to score',
  };
}

export function getDefaultOptimization(originalText, safetyOverride = false) {
  return {
    optimizedText: typeof originalText === 'string' ? originalText : '',
    changes: [],
    safetyOverride,
    protectedRegions: [],
  };
}
