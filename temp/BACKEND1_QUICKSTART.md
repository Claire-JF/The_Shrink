# Backend-1 Quick Start — 怎么接 Backend-2

## 30 秒总结

Backend-2 只有 3 个函数，全部在 main process 里调：

```javascript
warmup(client, config)                                       // app 启动时调一次
score(text, client, config)                                  // 用户按 Cmd+T 后调
optimize(text, scores, client, config, { protectedRegions }) // 用户按 Generate 后调
```

不需要 try/catch，不需要处理 null，返回值永远是有效 JSON。

---

## Step 1: 初始化（app 启动时）

```javascript
import { score, optimize, warmup, createClient, createMockClient } from './src/index.js';

// 从你的 config 系统读，或者直接读 process.env
const llmConfig = {
  baseURL: process.env.LLM_BASE_URL || 'https://api.clod.io/v1',
  apiKey: process.env.CLOD_API_KEY,
  fastModel: process.env.LLM_FAST_MODEL || 'Qwen2.5 7B',
  deepModel: process.env.LLM_DEEP_MODEL || 'Qwen2.5 72B',
};

// 没有 API key 时自动用 mock（返回固定假数据，格式完全一样）
const client = llmConfig.apiKey ? createClient(llmConfig) : createMockClient();

// 预热连接（异步，不阻塞启动）
warmup(client, llmConfig);
```

> 如果你还没拿到 CLōD API key，不设 `CLOD_API_KEY` 就行，自动 mock。所有接口都能跑，返回固定数据。

---

## Step 2: 用户按 Cmd+T — 调 `score()`

**时机：** 用户选中文字、按下快捷键后，你拿到了 `selectedText`。

```javascript
ipcMain.handle('score-text', async (event, selectedText) => {
  const result = await score(selectedText, client, llmConfig);
  return result;
});
```

**返回值 ScoreJSON：**

```json
{
  "clarity": 1.3,
  "safety": 5.0,
  "emotionalBalance": 5.0,
  "total": 3.77,
  "summary": "Prompt is vague and lacks specific details"
}
```

| 字段 | 类型 | 范围 | 含义 |
|---|---|---|---|
| `clarity` | number | 0–5 | 越高越好：prompt 是否清晰、具体、可执行 |
| `safety` | number | 0–5 | 越高越好：prompt 是否安全、无害 |
| `emotionalBalance` | number | 0–5 | 越高越好：prompt 是否理性客观、无情绪操控 |
| `total` | number | 0–5 | 三项平均 |
| `summary` | string | — | 一句话说明主要问题 |

**注意：**
- 真实 API 延迟约 **6-10 秒**，UI 应该显示 loading 状态
- Mock 延迟 200ms
- 永远不会抛异常。LLM 失败时返回所有分数 3.0 + summary "Unable to score"

---

## Step 3: 用户按 Generate — 调 `optimize()`

**时机：** UI 已经显示了评分，用户点了 "Generate" 按钮。

Frontend 可能传回用户划选的 Protected Regions（用户想保留原样的文本区域），也可能没有。

```javascript
ipcMain.handle('optimize-text', async (event, selectedText, scoreResult, protectedRegions) => {
  // protectedRegions 可能是 undefined / null / []，都没问题
  const result = await optimize(selectedText, scoreResult, client, llmConfig, { protectedRegions });
  return result;
});
```

### protectedRegions 参数格式

Frontend 传来的是字符偏移量数组（可选）：

```javascript
// 用户划选了 "我现在脑子已经有点炸了。" 这句话
[{ start: 223, end: 235 }]

// 用户没有划选任何内容
undefined  // 或 null 或 []
```

### 返回值 OptimizedJSON

```json
{
  "optimizedText": "重写后的完整文本...",
  "changes": ["改动说明1", "改动说明2"],
  "safetyOverride": false,
  "protectedRegions": [
    { "start": 709, "end": 721, "originalText": "我现在脑子已经有点炸了。" }
  ]
}
```

| 字段 | 类型 | 含义 |
|---|---|---|
| `optimizedText` | string | AI 重写后的完整文本（结构化的 AI-Intent 格式） |
| `changes` | string[] | 改动说明（2-5 条） |
| `safetyOverride` | boolean | `true` = 因安全原因忽略了所有保护区域 |
| `protectedRegions` | array | 被保护文本在 optimizedText 中的新位置 + 原文 |

### 三种场景

**场景 A：用户没有划选保护区域**
- 传 `undefined` / `null` / `[]` 都行
- AI 自由重写全文
- 返回 `safetyOverride: false, protectedRegions: []`

**场景 B：用户划选了保护区域，且内容安全**
- 保护区域原封不动保留在输出中
- 其余部分被重写为 AI-Intent 结构化格式
- 返回 `safetyOverride: false, protectedRegions: [{ start, end, originalText }]`

**场景 C：用户划选了保护区域，但 safety 评分 < 2.0**
- 保护被自动覆盖（Safety Override），AI 正常改写全文
- 返回 `safetyOverride: true, protectedRegions: []`
- Frontend 应提示用户："因安全原因，保护区域已被忽略"

**注意：**
- 需要把 Step 2 的 `scoreResult` 原样传进来（optimizer 需要知道哪些维度低）
- 真实 API 延迟约 **9-12 秒**
- 永远不会抛异常。LLM 失败时返回原文不变 + 空 changes 数组

---

## Step 4: 用户按 Copy

这一步不涉及 Backend-2。你直接把 `optimizedText` 写进剪贴板就行。

---

## 完整 IPC 流程图

```
┌──────────────────────────────────────────────────────────────────┐
│  Renderer (Frontend)                                             │
│                                                                  │
│  1. 显示 loading...                                              │
│  2. ipcRenderer.invoke('score-text', selectedText)               │
│  3. 收到 ScoreJSON → 显示 3 个分数 + summary                     │
│  4. 【可选】用户划选文本中想保留的区域 → protectedRegions         │
│  5. 用户点 Generate                                              │
│  6. ipcRenderer.invoke('optimize-text', text, scores, regions)   │
│  7. 收到 OptimizedJSON → 显示优化文本 + changes + 保护区域高亮   │
│  8. 如果 safetyOverride === true → 显示安全覆盖提示              │
│  9. 用户点 Copy → ipcRenderer.invoke('copy-text', optimizedText) │
└──────────────────────────────────────────────────────────────────┘
                          ↕ IPC
┌──────────────────────────────────────────────────────────────────┐
│  Main Process (Backend-1)                                        │
│                                                                  │
│  handle('score-text')    → score(text, client, config)           │
│  handle('optimize-text') → optimize(text, scores, client,        │
│                             config, { protectedRegions })        │
│  handle('copy-text')     → clipboard.writeText(text)             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 开发阶段 vs 真实 API

| | 无 API Key (Mock) | 有 API Key (CLōD) |
|---|---|---|
| 设置 | 什么都不用做 | `.env` 里填 `CLOD_API_KEY` |
| score() 延迟 | 200ms | 6-10s |
| optimize() 延迟 | 200ms | 9-12s |
| 返回数据 | 固定假数据 | 真实 AI 评分 |
| 数据格式 | 完全一样 | 完全一样 |

先用 mock 把 IPC 流程和 UI 全跑通，最后接真实 API 只是加一个环境变量。

---

## 你不需要操心的事

- JSON 解析 — Backend-2 内部处理
- LLM 报错 — Backend-2 自动 retry + fallback
- 数据验证 — Backend-2 保证返回值格式正确
- Protected Region 保留 — Backend-2 内部处理标记注入 + 验证
- Safety Override — Backend-2 自动判断并拦截
- try/catch — 不需要，这三个函数永远 resolve
