export function getDefaultScore() {
  return {
    clarity: 3.0,
    safety: 3.0,
    emotionalBalance: 3.0,
    total: 3.0,
    summary: 'Unable to score',
  };
}

export function getDefaultOptimization(originalText) {
  return {
    optimizedText: originalText,
    changes: [],
  };
}
