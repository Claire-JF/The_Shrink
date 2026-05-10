# Backend-1 ↔ Backend-2 Integration Contract

Backend-2 is a pure JS library (ESM under `src/`). Backend-1 imports and calls it from the Electron main process via **`backend1/brain.js`** dynamic `import()`.

The **Zoe** branch ships the **cat companion** renderer; UI talks to Backend-1 only through **`preload.js`** (`window.shrink`). See **[AGENT_CONTEXT.md](AGENT_CONTEXT.md)** for IPC and **[README.md](README.md)** for run/setup.

## Import

```javascript
import { score, optimize, warmup, chat } from './src/index.js';
import { createClient } from './src/llm/client.js';
import { createMockClient } from './src/llm/mock-client.js';
```

## Setup

```javascript
const llmConfig = {
  baseURL: config.get('LLM_BASE_URL'), // "https://api.clod.io/v1"
  apiKey: config.get('CLOD_API_KEY'),
  fastModel: config.get('LLM_FAST_MODEL'),
  deepModel: config.get('LLM_DEEP_MODEL'),
};

const client = llmConfig.apiKey ? createClient(llmConfig) : createMockClient();
```

## Functions

### `warmup(client, config) → Promise<void>`

Call once on app startup. **Never throws** — logs a warning on failure and resolves.

### `score(text, client, config) → Promise<ScoreJSON>`

Scores input on three quality dimensions (clarity, emotionalBalance, safety). Uses `config.fastModel` at temperature 0 (with JSON mode in implementation).

### `optimize(text, scoreResult, client, config, options?) → Promise<OptimizedJSON>`

Rewrites text. Uses `config.deepModel` at temperature ~0.2 with JSON response format.

**Fifth argument (optional):**

```javascript
await optimize(text, scoreResult, client, llmConfig, {
  protectedRegions: [{ start: 10, end: 24 }], // UTF-16 indices into `text`, half-open [start, end)
});
```

- **`protectedRegions`** — omit or `[]` for behavior equivalent to “rewrite everything.”
- **Safety override:** If **`scoreResult.safety < 2.0`**, Backend-2 **clears** all protected regions in logic and performs a full rewrite; result includes **`safetyOverride: true`** and empty **`protectedRegions`**.
- Model output may include stray **`<<PROTECTED>>`** markers — implementation strips them from **`optimizedText`** before returning.

Implementation details: **`src/optimizer.js`**, **`src/prompts/optimization.js`**, **`src/protected-regions.js`**.

### `chat(messages, client, config) → Promise<{ role, content }>`

Multi-turn assistant (optional product feature). Uses `config.chatModel` or `config.deepModel`.

## Data shapes

### ScoreJSON

```json
{
  "clarity": 2.1,
  "emotionalBalance": 3.8,
  "safety": 5.0,
  "total": 3.63,
  "summary": "Vague ask; emotionally neutral; safe to help"
}
```

| Field | Meaning |
|-------|---------|
| `clarity` | How clear and actionable the request is (0–5). |
| `emotionalBalance` | How objective and non-coercive the tone is; higher = more professional (0–5). |
| `safety` | Risk / harm of complying; higher = safer (0–5). |

All dimension values are **0.0–5.0**. **`total`** is the mean of the three dimensions. **`summary`** is one line.

### OptimizedJSON

```json
{
  "optimizedText": "The improved version of the text...",
  "changes": [
    "Added specific details",
    "Clarified constraints"
  ],
  "safetyOverride": false,
  "protectedRegions": [
    { "start": 120, "end": 145, "originalText": "verbatim slice from optimizedText" }
  ]
}
```

| Field | Type | Notes |
|-------|------|--------|
| `optimizedText` | string | Full rewritten prompt |
| `changes` | string[] | 2–5 bullets describing edits |
| `safetyOverride` | boolean | **`true`** when safety rules forced ignoring user-protected spans |
| `protectedRegions` | array | Spans in **`optimizedText`** that were preserved verbatim; may be empty |

Legacy **`optimized_text`** / **`optimizedText`** — Backend-1 tolerates both for clipboard paths where relevant.

## Error behavior

**Backend-2 must not throw** on `score` / `optimize` / `warmup` in normal design; failures degrade to neutral or passthrough shapes (see **`src/fallback.js`**).

| Function | Typical failure shape |
|----------|------------------------|
| `score()` | Neutral dimensions 3.0, summary `"Unable to score"` |
| `optimize()` | Original text, empty `changes`, `safetyOverride` / `protectedRegions` per fallback |
| `warmup()` | Resolves; logs warning |

## Config keys (via `config` / `.env`)

| Key | Purpose |
|-----|---------|
| `CLOD_API_KEY` | CLōD API key (omit → mock client) |
| `LLM_BASE_URL` | OpenAI-compatible base URL |
| `LLM_FAST_MODEL` | Scoring model |
| `LLM_DEEP_MODEL` | Optimize / default chat |
| `LLM_CHAT_MODEL` | Optional; defaults to deep model |

### Related repo docs

- **`AGENT_CONTEXT.md`** — selection (UIA + clipboard), IPC, hotkeys, file layout.
- **`temp/PROTECTED_REGIONS_SPEC.md`** — product copy for protected regions.

## Backend-1 threshold note

`score` / `optimize` return data only; **when** to open the widget or call **`optimize`** is decided in Backend-1/renderer. The hover UI currently presents capture results after each hotkey run per product flow.
