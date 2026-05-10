# Demo Prompt 测试结果

## Prompt 1: Toon Shading 优先级问题

### 原始 Prompt

```
明天要给团队 demo，但我现在 toon shading 还没 fully work……
scan effect、outline、角色受击闪白这几个东西互相打架。

我不知道该继续硬修 technical issue，还是先 fake 一个能看的版本。

如果你是 TA / shader programmer，你会怎么 prioritise？
能不能帮我拆一下：

哪些是 demo 必须有的
哪些可以先 cheat
哪些最容易花时间黑洞

我现在脑子已经有点炸了。
```

### 评分结果（Qwen2.5 7B, 9.9s）

| 维度 | 分数 |
|---|---|
| Clarity | 5.0 |
| Safety | 5.0 |
| Emotional Balance | 3.8 |
| **Total** | **4.6** |

> Summary: "Slight emotional overload expressed, but request remains objective and actionable."

### 优化结果（Qwen2.5 72B, 11.7s）

**优化后文本：**

```
明天要给团队做 demo，但我现在 toon shading 还没有完全实现。scan effect、outline、角色受击闪白这几个效果之间有冲突。请帮我分析一下：

1. 哪些效果是 demo 必须要有的？
2. 哪些效果可以先用临时方案或简化处理？
3. 哪些问题最容易变成时间黑洞？

如果你是 TA 或 shader programmer，你会如何优先排序这些任务？谢谢！
```

**改动：**

1. 去除了"脑子已经有点炸了"等情绪化表达
2. 将问题描述和请求分点列出，使表达更客观
3. 保持原有的具体技术背景和请求内容

---

## Prompt 2: 极度模糊的 Shader 请求

### 原始 Prompt

```
能不能帮我看看这个 shader？
```

### 评分结果（Qwen2.5 7B, 8.5s）

| 维度 | 分数 |
|---|---|
| Clarity | 1.3 |
| Safety | 5.0 |
| Emotional Balance | 5.0 |
| **Total** | **3.77** |

> Summary: "The prompt lacks specific details and context about the shader in question."

### 优化结果（Qwen2.5 72B, 9.4s）

**优化后文本：**

```
能不能帮我看看这个 shader，帮我分析一下它的功能和可能存在的问题？以下是 shader 代码：
[请在这里粘贴你的 shader 代码]
请指出代码中的潜在错误或优化建议，并简要说明每一部分的作用。
```

**改动：**

1. 补充了需要用户提供 shader 代码的具体要求
2. 明确请求分析功能、潜在问题和优化建议
3. 要求简要说明代码各部分作用
4. 结构化了请求，使其更具体和易于理解
