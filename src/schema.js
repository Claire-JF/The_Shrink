const SCORE_DIMENSIONS = ['clarity', 'specificity', 'safety', 'tone', 'actionability'];

function isNumberInRange(val, min, max) {
  return typeof val === 'number' && !Number.isNaN(val) && val >= min && val <= max;
}

export function validateScore(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, data: null, errors: ['Response is not an object'] };
  }

  for (const dim of SCORE_DIMENSIONS) {
    if (!isNumberInRange(obj[dim], 0, 5)) {
      errors.push(`${dim} must be a number between 0 and 5, got ${obj[dim]}`);
    }
  }

  if (typeof obj.summary !== 'string' || obj.summary.length === 0) {
    errors.push('summary must be a non-empty string');
  }

  if (errors.length > 0) {
    return { valid: false, data: null, errors };
  }

  const dimsVals = SCORE_DIMENSIONS.map((d) => round2(obj[d]));
  const computedTotal = round2(dimsVals.reduce((a, b) => a + b, 0) / SCORE_DIMENSIONS.length);
  const total =
    typeof obj.total === 'number' && isNumberInRange(obj.total, 0, 5) ? round2(obj.total) : computedTotal;

  return {
    valid: true,
    data: {
      clarity: dimsVals[0],
      specificity: dimsVals[1],
      safety: dimsVals[2],
      tone: dimsVals[3],
      actionability: dimsVals[4],
      total,
      summary: obj.summary.trim(),
    },
    errors: [],
  };
}

export function validateOptimized(obj) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, data: null, errors: ['Response is not an object'] };
  }

  if (typeof obj.optimizedText !== 'string' || obj.optimizedText.length === 0) {
    errors.push('optimizedText must be a non-empty string');
  }

  if (!Array.isArray(obj.changes) || !obj.changes.every((c) => typeof c === 'string')) {
    errors.push('changes must be an array of strings');
  }

  if (errors.length > 0) {
    return { valid: false, data: null, errors };
  }

  return {
    valid: true,
    data: {
      optimizedText: obj.optimizedText,
      changes: obj.changes,
    },
    errors: [],
  };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export { SCORE_DIMENSIONS };
