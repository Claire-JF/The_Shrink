import 'dotenv/config';
import { score, optimize, client, config } from '../src/index.js';

const text = `能不能帮我看看这个 shader？`;

console.log('=== Client:', config.apiKey ? 'LIVE' : 'MOCK', '===');
console.log('Fast model:', config.fastModel);
console.log('Deep model:', config.deepModel);
console.log();

console.log('--- SCORING ---');
const t1 = Date.now();
const s = await score(text, client, config);
console.log('Time:', Date.now() - t1, 'ms');
console.log(JSON.stringify(s, null, 2));

console.log();
console.log('--- OPTIMIZING ---');
const t2 = Date.now();
const o = await optimize(text, s, client, config);
console.log('Time:', Date.now() - t2, 'ms');
console.log(JSON.stringify(o, null, 2));
