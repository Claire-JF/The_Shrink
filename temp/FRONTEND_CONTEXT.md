# 前端需要知道的事 — Backend-2 当前状态

## 你的 UI 会收到什么数据

### 1. 评分结果 (ScoreJSON)

用户按 Cmd+T 后，Backend-1 会通过 IPC 把这个 JSON 传给你：

```json
{
  "clarity": 1.3,
  "safety": 5.0,
  "emotionalBalance": 5.0,
  "total": 3.77,
  "summary": "Prompt is vague and lacks specific details or context"
}
```

| 字段 | 类型 | 范围 | 含义 |
|---|---|---|---|
| `clarity` | number | 0.0–5.0 | 越高越好：prompt 是否清晰、具体、可执行 |
| `safety` | number | 0.0–5.0 | 越高越好：prompt 是否安全、无害 |
| `emotionalBalance` | number | 0.0–5.0 | 越高越好：prompt 是否理性客观、无情绪操控 |
| `total` | number | 0.0–5.0 | 三个维度的平均分 |
| `summary` | string | — | 一句话描述最大的问题 |

### 2. 优化结果 (OptimizedJSON)

用户点 "Generate" 后，Backend-1 会传给你：

```json
{
  "optimizedText": "重写后的 prompt 全文...",
  "changes": [
    "将模糊引用替换为具体主题",
    "移除威胁性语言，改为事实性表达",
    "添加了明确的截止日期"
  ]
}
```

| 字段 | 类型 | 含义 |
|---|---|---|
| `optimizedText` | string | 优化后的完整文本 |
| `changes` | string[] | 具体做了哪些改动（2-5 条） |

## 用户交互流程

```
1. 用户选中文字 → 按 Cmd+T
2. UI 收到 ScoreJSON → 显示 3 个维度的分数 + summary
3. 用户点 "Generate" 按钮
4. UI 收到 OptimizedJSON → 显示优化后的文本 + 改动列表
5. 用户点 "Copy" → 优化文本进剪贴板
```

## UI 设计建议

### 分数展示
- 3 个维度各一个分数条/圆环（0-5）
- 颜色参考：0-1.9 红色, 2.0-3.4 黄色, 3.5-5.0 绿色
- `summary` 显示在分数下方作为一句话说明

### 按钮
- "Generate" — 触发优化（不管分数高低，用户想按就按）
- "Copy" — 把 `optimizedText` 写入剪贴板

### 注意事项
- 数据**永远是有效的**。Backend-2 保证不会返回 null 或 undefined
- 如果 LLM 失败，会返回所有分数 3.0 + summary "Unable to score"
- 不需要前端做 error handling，你收到的 JSON 格式永远一致

## 当前技术栈

- LLM provider: CLōD (api.clod.io)
- 评分模型: Qwen2.5 7B（快，免费）
- 优化模型: Qwen2.5 72B（强，免费）
- 评分延迟: ~8-15 秒
- 优化延迟: ~10-20 秒

## Mock 模式

没有 API key 时自动使用 mock，返回固定数据。前端可以直接开发 UI 不需要等 API。
