import { createMockClient } from '../src/llm/mock-client.js';
import { score } from '../src/scorer.js';
import { optimize } from '../src/optimizer.js';
import { warmup } from '../src/warmup.js';

const client = createMockClient();
const config = { fastModel: 'Qwen2.5 7B', deepModel: 'Qwen2.5 72B' };

console.log('=== Mock Client Verification (3 dimensions) ===\n');

// 1. Warmup
console.log('1. warmup()');
await warmup(client, config);
console.log('   OK - resolved without throwing\n');

// 2. Score
console.log('2. score()');
const scoreResult = await score('Test text for scoring', client, config);
console.log('   Result:', JSON.stringify(scoreResult, null, 2));

const scoreKeys = ['clarity', 'safety', 'emotionalBalance', 'total', 'summary'];
const missingScoreKeys = scoreKeys.filter(k => !(k in scoreResult));
const allScoreNumbers = scoreKeys.filter(k => k !== 'summary').every(k => typeof scoreResult[k] === 'number');
const summaryIsString = typeof scoreResult.summary === 'string';

console.log(`   Keys present: ${missingScoreKeys.length === 0 ? 'ALL OK' : 'MISSING: ' + missingScoreKeys.join(', ')}`);
console.log(`   Dimensions are numbers: ${allScoreNumbers ? 'OK' : 'FAIL'}`);
console.log(`   Summary is string: ${summaryIsString ? 'OK' : 'FAIL'}\n`);

// 3. Optimize
console.log('3. optimize()');
const optResult = await optimize('Vague test text', scoreResult, client, config);
console.log('   Result:', JSON.stringify(optResult, null, 2));

const hasOptText = typeof optResult.optimizedText === 'string' && optResult.optimizedText.length > 0;
const hasChanges = Array.isArray(optResult.changes) && optResult.changes.every(c => typeof c === 'string');

console.log(`   optimizedText is non-empty string: ${hasOptText ? 'OK' : 'FAIL'}`);
console.log(`   changes is string[]: ${hasChanges ? 'OK' : 'FAIL'}\n`);

// Summary
const allPassed = missingScoreKeys.length === 0 && allScoreNumbers && summaryIsString && hasOptText && hasChanges;
console.log(`=== ${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'} ===`);
process.exit(allPassed ? 0 : 1);
