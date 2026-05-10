import 'dotenv/config';
import { score, optimize, client, config } from '../src/index.js';

const text = `明天要给团队 demo，但我现在 toon shading 还没 fully work……
scan effect、outline、角色受击闪白这几个东西互相打架。

我不知道该继续硬修 technical issue，还是先 fake 一个能看的版本。

如果你是 TA / shader programmer，你会怎么 prioritise？
能不能帮我拆一下：

哪些是 demo 必须有的
哪些可以先 cheat
哪些最容易花时间黑洞

我现在脑子已经有点炸了。`;

const protectedSnippet = '我现在脑子已经有点炸了。';
const protectedStart = text.indexOf(protectedSnippet);
const protectedRegions = [
  { start: protectedStart, end: protectedStart + protectedSnippet.length },
];

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
console.log('--- OPTIMIZING (with protected region) ---');
console.log('Protected:', JSON.stringify(protectedRegions), '→', JSON.stringify(protectedSnippet));
const t2 = Date.now();
const o = await optimize(text, s, client, config, { protectedRegions });
console.log('Time:', Date.now() - t2, 'ms');
console.log(JSON.stringify(o, null, 2));

const preserved = o.optimizedText.includes(protectedSnippet);
console.log();
console.log('--- VERIFICATION ---');
console.log('Protected text preserved:', preserved ? 'YES' : 'NO — FAILED');
console.log('Safety override:', o.safetyOverride);
console.log('Protected regions in output:', o.protectedRegions.length);
