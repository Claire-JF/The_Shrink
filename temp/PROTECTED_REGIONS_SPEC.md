# Protected Regions — 新功能规格

## 一句话

用户可以**划选 prompt 中想保留原样的区域**，AI 只改写其余部分。但如果内容有安全问题，保护自动失效。

---

## 用户流程

```
1. 用户选中文字 → 按 Cmd+T → 看到 3 个维度评分
2. 【新】用户在 prompt 文本上划选想保留的部分（高亮显示）
3. 用户点 Generate
4. AI 只改写未保护的部分，保护区域逐字保留
5. 用户点 Copy
```

**例外：** 如果 safety 评分 < 2.0，保护自动失效，AI 正常改写全文。

---

## 数据格式

### 输入：Frontend → Backend-1 → Backend-2

Frontend 把用户划选的区域转换为字符偏移量数组，通过 IPC 传递：

```javascript
// 用户划选了 "我现在脑子已经有点炸了"
const protectedRegions = [
  { start: 142, end: 155 }  // 字符偏移量，前闭后开
];

// IPC 调用
ipcRenderer.invoke('optimize-text', selectedText, scoreResult, protectedRegions);
```

可以有多个 protected regions（用户多次划选）。也可以没有（和现在行为一样）。

### Backend-1 透传

```javascript
ipcMain.handle('optimize-text', async (event, text, scoreResult, protectedRegions) => {
  const result = await optimize(text, scoreResult, client, config, { protectedRegions });
  return result;
});
```

### 输出：Backend-2 → Backend-1 → Frontend

#### 正常情况（有保护区域）

```json
{
  "optimizedText": "明天要给团队做 demo，但我现在 toon shading 还没有完全实现。...... 我现在脑子已经有点炸了。",
  "changes": ["结构化了问题列表", "补充了具体技术细节"],
  "safetyOverride": false,
  "protectedRegions": [
    { "start": 135, "end": 148, "originalText": "我现在脑子已经有点炸了" }
  ]
}
```

#### Safety Override（保护被覆盖）

```json
{
  "optimizedText": "...",
  "changes": ["Removed harmful content (safety override: protected regions ignored)"],
  "safetyOverride": true,
  "protectedRegions": []
}
```

#### 没有保护区域（向后兼容）

```json
{
  "optimizedText": "...",
  "changes": ["..."],
  "safetyOverride": false,
  "protectedRegions": []
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `optimizedText` | string | 重写后的完整文本 |
| `changes` | string[] | 改动说明（2-5 条） |
| `safetyOverride` | boolean | `true` = 因安全原因忽略了所有保护区域 |
| `protectedRegions` | array | 保留区域在 optimizedText 中的新位置 + 原文 |

---

## Safety Override 规则

**当 `scoreResult.safety < 2.0` 时，所有保护区域自动失效。**

这是代码层面的硬性拦截，不依赖 LLM 判断：

```
safety >= 2.0  →  保护生效，AI 保留划选区域
safety < 2.0   →  保护失效，AI 正常改写全文，返回 safetyOverride: true
```

### Frontend 需要处理

当收到 `safetyOverride: true` 时，建议显示提示：
> "因安全原因，保护区域已被忽略。"

---

## Frontend 需要做什么

### 1. 划选交互

- 评分展示后、Generate 之前，用户可以在 prompt 文本上**拖选**（类似文本高亮）
- 划选的区域用高亮色标记，表示"这部分我要保留"
- 支持多次划选（多个 protected regions）
- 支持取消划选（点击已选区域取消）
- 不划选也没关系——不传 `protectedRegions` 或传空数组，行为和现在完全一样

### 2. 结果展示

- optimizedText 中保护区域用不同样式标记（让用户看到哪些是原封不动保留的）
- 可以用 `protectedRegions` 数组中的 `start` / `end` 定位高亮位置
- `safetyOverride: true` 时显示安全提示

### 3. 颜色建议

| 区域 | 颜色 |
|---|---|
| 保护区域（划选时） | 蓝色高亮 |
| 保护区域（结果中） | 蓝色下划线或浅蓝背景 |
| Safety Override 提示 | 红色/橙色警告 |

---

## Backend-1 需要做什么

改动很小：

1. IPC `optimize-text` 频道新增第三个参数 `protectedRegions`
2. 透传给 `optimize()` 的第五个参数：`{ protectedRegions }`
3. 把返回的 `safetyOverride` 和 `protectedRegions` 一起传给 Frontend

```javascript
// 之前
ipcMain.handle('optimize-text', async (event, text, scoreResult) => {
  return await optimize(text, scoreResult, client, config);
});

// 之后
ipcMain.handle('optimize-text', async (event, text, scoreResult, protectedRegions) => {
  return await optimize(text, scoreResult, client, config, { protectedRegions });
});
```

不传 `protectedRegions` 时完全向后兼容。

---

## Backend-2 会改什么（已由 Backend-2 负责，仅供参考）

1. `optimize()` 新增可选参数 `{ protectedRegions }`
2. Optimization prompt 加入 `<<PROTECTED>>` 标记规则
3. Validator 增加 post-check：验证 optimizedText 确实包含被保护的原文
4. Safety Override 在代码层面拦截（safety < 2.0 → 清空保护）
5. Mock client 更新，支持返回新字段

---

## 向后兼容

| 情况 | 行为 |
|---|---|
| 不传 protectedRegions | 和现在完全一样 |
| 传空数组 `[]` | 和现在完全一样 |
| 传了区域但 safety < 2.0 | 忽略保护，正常改写，返回 `safetyOverride: true` |
| 传了区域且 safety >= 2.0 | 保护生效，只改写未保护部分 |
