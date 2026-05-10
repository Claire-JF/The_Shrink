# Backend-1 Quick Start — 怎么接 Backend-2

## 30 秒总结

Backend-2 只有 3 个函数，全部在 main process 里调：

```javascript
warmup(client, config)           // app 启动时调一次
score(text, client, config)      // 用户按 Cmd+T 后调
optimize(text, scores, client, config)  // 用户按 Generate 后调
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
  // result 的格式永远是：
  // {
  //   clarity: 1.3,          // 0-5, 越高越好
  //   safety: 5.0,           // 0-5, 越高越好
  //   emotionalBalance: 5.0, // 0-5, 越高越好
  //   total: 3.77,           // 三项平均
  //   summary: "一句话说明主要问题"
  // }
});
```

**注意：**
- 真实 API 延迟约 **8-15 秒**，UI 应该显示 loading 状态
- Mock 延迟 200ms
- 永远不会抛异常。LLM 失败时返回所有分数 3.0 + summary "Unable to score"

---

## Step 3: 用户按 Generate — 调 `optimize()`

**时机：** UI 已经显示了评分，用户点了 "Generate" 按钮。

```javascript
ipcMain.handle('optimize-text', async (event, selectedText, scoreResult) => {
  const result = await optimize(selectedText, scoreResult, client, llmConfig);
  return result;
  // result 的格式永远是：
  // {
  //   optimizedText: "重写后的完整文本...",
  //   changes: ["改动说明1", "改动说明2", ...]
  // }
});
```

**注意：**
- 需要把 Step 2 的 `scoreResult` 原样传进来（optimizer 需要知道哪些维度低）
- 真实 API 延迟约 **10-15 秒**
- 永远不会抛异常。LLM 失败时返回原文不变 + 空 changes 数组

---

## Step 4: 用户按 Copy

这一步不涉及 Backend-2。你直接把 `optimizedText` 写进剪贴板就行。

---

## 完整 IPC 流程图

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (Frontend)                                    │
│                                                         │
│  1. 显示 loading...                                     │
│  2. ipcRenderer.invoke('score-text', selectedText)      │
│  3. 收到 ScoreJSON → 显示 3 个分数 + summary            │
│  4. 用户点 Generate                                     │
│  5. ipcRenderer.invoke('optimize-text', text, scores)   │
│  6. 收到 OptimizedJSON → 显示优化文本 + changes          │
│  7. 用户点 Copy → ipcRenderer.invoke('copy-text', text) │
└─────────────────────────────────────────────────────────┘
                          ↕ IPC
┌─────────────────────────────────────────────────────────┐
│  Main Process (Backend-1)                               │
│                                                         │
│  handle('score-text')    → score(text, client, config)  │
│  handle('optimize-text') → optimize(text, scores, ...)  │
│  handle('copy-text')     → clipboard.writeText(text)    │
└─────────────────────────────────────────────────────────┘
```

---

## 开发阶段 vs 真实 API

| | 无 API Key (Mock) | 有 API Key (CLōD) |
|---|---|---|
| 设置 | 什么都不用做 | `.env` 里填 `CLOD_API_KEY` |
| score() 延迟 | 200ms | 8-15s |
| optimize() 延迟 | 200ms | 10-15s |
| 返回数据 | 固定假数据 | 真实 AI 评分 |
| 数据格式 | 完全一样 | 完全一样 |

先用 mock 把 IPC 流程和 UI 全跑通，最后接真实 API 只是加一个环境变量。

---

## 你不需要操心的事

- JSON 解析 — Backend-2 内部处理
- LLM 报错 — Backend-2 自动 retry + fallback
- 数据验证 — Backend-2 保证返回值格式正确
- try/catch — 不需要，这三个函数永远 resolve
