import 'dotenv/config';
import { createClient } from '../src/llm/client.js';
import { createMockClient } from '../src/llm/mock-client.js';
import { score } from '../src/scorer.js';
import { FIXTURES } from './fixtures.js';

const RUNS = parseInt(
  process.argv.find((a) => a.startsWith('--runs='))?.split('=')[1] || '20',
  10
);

const config = {
  baseURL: process.env.LLM_BASE_URL || 'https://api.clod.io/v1',
  apiKey: process.env.CLOD_API_KEY,
  fastModel: process.env.LLM_FAST_MODEL || 'Qwen2.5 7B',
  deepModel: process.env.LLM_DEEP_MODEL || 'Qwen2.5 72B',
};

const client = config.apiKey ? createClient(config) : createMockClient();
const usingMock = !config.apiKey;

console.log(`\n=== Stability Test ===`);
console.log(`Runs per fixture: ${RUNS}`);
console.log(`Client: ${usingMock ? 'MOCK (no API key set)' : 'LIVE (' + config.baseURL + ')'}`);
console.log(`Model: ${config.fastModel}\n`);

let allPassed = true;

for (const fixture of FIXTURES) {
  const { field, below } = fixture.expect;
  console.log(`--- Fixture: "${fixture.name}" (expect ${field} < ${below}) ---`);
  const scores = [];

  for (let i = 0; i < RUNS; i++) {
    const result = await score(fixture.text, client, config);
    scores.push(result);

    const cols = [
      `#${String(i + 1).padStart(2)}`,
      `clarity=${result.clarity.toFixed(1)}`,
      `specificity=${result.specificity.toFixed(1)}`,
      `safety=${result.safety.toFixed(1)}`,
      `tone=${result.tone.toFixed(1)}`,
      `action=${result.actionability.toFixed(1)}`,
      `TOTAL=${result.total.toFixed(2)}`,
    ];
    console.log(`  ${cols.join('  ')}`);
  }

  const values = scores.map((s) => s[field]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const allBelow = values.every((v) => v < below);

  console.log(
    `\n  Stats (${field}): mean=${mean.toFixed(2)}  stdDev=${stdDev.toFixed(2)}  min=${min.toFixed(2)}  max=${max.toFixed(2)}`
  );
  console.log(`  Pass (all ${field} < ${below}): ${allBelow ? 'YES' : 'NO -- FAILED'}\n`);

  if (!allBelow) allPassed = false;
}

console.log(`=== ${allPassed ? 'ALL PASSED' : 'SOME FAILED'} ===\n`);
process.exit(allPassed ? 0 : 1);
