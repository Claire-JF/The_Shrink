# LLM Client 测试指南

## 目前（无 API Key）：用 Mock Client 测试

不需要任何 API key，mock client 会返回固定的假数据，数据格式和真实 LLM 一模一样。

### 运行方式

```bash
# 验证 mock client 输出格式正确
node tests/verify-mock.js

# 跑稳定性测试（mock 模式，分数是固定的所以 pass/fail 不用看）
node tests/stability-test.js --runs=2
```

### Backend-1 集成测试

不设 `CLOD_API_KEY` 环境变量，直接 import 就行：

```javascript
import { score, optimize, warmup, client, config } from './src/index.js';

// 自动使用 mock client
await warmup(client, config);
const result = await score('任意文本', client, config);
console.log(result);
// → 固定返回 { clarity: 1.3, safety: 5.0, emotionalBalance: 5.0, total: 3.77, summary: "..." }

const optimized = await optimize('任意文本', result, client, config);
console.log(optimized);
// → 固定返回 { optimizedText: "...", changes: [...] }
```

Mock 的特点：
- 每次返回相同数据（方便 UI 调试）
- 有 200ms 模拟延迟
- warmup / score / optimize 三个功能都能跑通
- 不需要网络连接

---

## 未来（有 CLōD API Key 后）：用真实 LLM 测试

### 第一步：配置 .env

把 `.env.example` 复制为 `.env`，填入真实 key：

```bash
cp .env.example .env
```

```env
CLOD_API_KEY=你的真实key
LLM_BASE_URL=https://api.clod.io/v1
LLM_FAST_MODEL=Qwen2.5 7B
LLM_DEEP_MODEL=Qwen2.5 72B
```

### 第二步：验证连接

```bash
# warmup 会发一个简单请求，验证 key 是否有效
node -e "import('./src/index.js').then(m => m.warmup(m.client, m.config))"
```

看到 `[warmup] connection ready` 就说明 CLōD 连通了。

### 第三步：快速冒烟测试（9 次请求）

```bash
node tests/stability-test.js --runs=3
```

这会用真实 LLM 对 3 个测试文本各跑 3 次评分，消耗 9 次 API 请求。
检查输出：每次的分数应该不同（因为是真实 AI 在评分），但同一文本的分数应该比较接近。

### 第四步：完整稳定性测试（60 次请求）

```bash
node tests/stability-test.js
```

默认 20 次 × 3 个 fixture = 60 次请求。
通过标准：
- vague 文本的 clarity 全部 < 2.5
- danger 文本的 safety 全部 < 1.5
- emotional_manipulation 文本的 emotionalBalance 全部 < 1.5

如果不通过，需要调整 `src/prompts/scoring.js` 里的 checklist 规则，然后用 `--runs=3` 快速迭代。

### 注意：CLōD 免费额度

- 免费账户每天 100 次请求，午夜自动刷新
- 完整稳定性测试消耗 60 次（每天最多跑 1 次）
- 快速测试只消耗 9 次（适合迭代 prompt）
- 正常 app 使用每次交互消耗 2 次（score + optimize）

---

## 切换到 OpenAI（备用方案）

如果 CLōD 出问题，改 `.env` 三行就能切到 OpenAI：

```env
CLOD_API_KEY=sk-你的openai-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_FAST_MODEL=gpt-4o-mini
LLM_DEEP_MODEL=gpt-4o
```

代码不需要任何改动。
