# 交接给下一个聊天的上下文

## 当前进度

### 已完成
- [x] Step 1: CLōD API 连通，模型选定（Qwen2.5 7B 打分，Qwen2.5 72B 重写）
- [x] Step 2: Scoring prompt（3 维度 checklist），稳定性测试全通过（stdDev = 0.00）
- [x] Backend-2 全部代码已写好（src/ 和 tests/）
- [x] Mock client 已验证，Backend-1 可以不用 API key 直接开发
- [x] INTEGRATION_CONTRACT.md 和 FRONTEND_CONTEXT.md 已写好

### 未完成
- [ ] Step 3: 优化功能（optimizer.js）还没用真实 CLōD 测过，只测了 mock
- [ ] 所有代码还没 commit 到 git（只 push 了 src/llm/ 和 temp/FRONTEND_CONTEXT.md）
- [ ] .env.example 和 BACKEND2_PLAN.md 也还没 commit
- [ ] TESTING_GUIDE.md 需要更新（模型从 DeepSeek V3 改成了 Qwen2.5）

## 关键文件

| 文件 | 作用 |
|---|---|
| `src/llm/client.js` | CLōD API wrapper（openai SDK） |
| `src/llm/mock-client.js` | 假 LLM，返回固定 JSON |
| `src/scorer.js` | score(text) → ScoreJSON |
| `src/optimizer.js` | optimize(text, scores) → OptimizedJSON |
| `src/prompts/scoring.js` | 3 维度 checklist prompt（核心！） |
| `src/prompts/optimization.js` | 重写 prompt |
| `src/schema.js` | JSON 验证（3 维度：clarity, safety, emotionalBalance） |
| `src/fallback.js` | LLM 失败时的安全默认值 |
| `src/warmup.js` | 启动预热 |
| `src/index.js` | 公共入口，Backend-1 从这里 import |
| `tests/stability-test.js` | 稳定性测试脚本 |
| `tests/fixtures.js` | 3 个测试用例（vague, danger, emotional_manipulation） |
| `INTEGRATION_CONTRACT.md` | Backend-1 交接文档 |
| `.env` | 真实 API key（已配置，不要提交到 git） |

## 3 维度评分系统

全部 0-5 分，越高越好：
- **Clarity** — prompt 是否清晰、具体、可执行
- **Safety** — prompt 是否安全、无害、可逆
- **Emotional Balance** — prompt 是否理性客观、无情绪操控

## 技术决策记录

1. **DeepSeek V3 不能用** — 它会输出 chain-of-thought 推理文本而不是纯 JSON，换成了 Qwen
2. **JSON mode (response_format)** 在 CLōD 上对 DeepSeek V3 无效，但 Qwen 不需要它也能正确输出 JSON
3. **分数方向统一为"越高越好"** — Emotional Risk 改名为 Emotional Balance
4. **优化是用户触发的** — 不做 threshold 自动触发，用户按 Generate 才调 optimize()
5. **client.js 支持 jsonMode 参数** — scorer 和 optimizer 都开启了 `jsonMode: true`

## .env 配置

```
CLOD_API_KEY=eyJ...（已配置）
LLM_BASE_URL=https://api.clod.io/v1
LLM_FAST_MODEL=Qwen2.5 7B
LLM_DEEP_MODEL=Qwen2.5 72B
```

## 下一步建议

1. 用真实 CLōD 测试 optimizer（`node -e "import('./src/index.js').then(async m => { const s = await m.score('help me with the thing', m.client, m.config); console.log(s); const o = await m.optimize('help me with the thing', s, m.client, m.config); console.log(o); })"`)
2. 把剩余代码全部 commit + push
3. 更新 TESTING_GUIDE.md（模型名称改了）
4. 等 Backend-1 准备好后做联调
