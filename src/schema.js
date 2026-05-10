const SCORE_DIMENSIONS = ['clarity', 'safety', 'emotionalBalance'];

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

  const total = SCORE_DIMENSIONS.reduce((sum, d) => sum + obj[d], 0) / SCORE_DIMENSIONS.length;

  return {
    valid: true,
    data: {
      clarity: round2(obj.clarity),
      safety: round2(obj.safety),
      emotionalBalance: round2(obj.emotionalBalance),
      total: round2(total),
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

  if (!Array.isArray(obj.changes) || !obj.changes.every(c => typeof c === 'string')) {
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
  return Math.round(n * 100) / 100;
}

export { SCORE_DIMENSIONS };
