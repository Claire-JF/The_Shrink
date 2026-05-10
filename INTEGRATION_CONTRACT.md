# Backend-1 ↔ Backend-2 Integration Contract

Backend-2 is a pure JS library. Backend-1 imports and calls it from the Electron main process.

## Import

```javascript
import { score, optimize, warmup } from './src/index.js';
import { createClient } from './src/llm/client.js';
import { createMockClient } from './src/llm/mock-client.js';
```

## Setup

```javascript
const llmConfig = {
  baseURL: config.get('LLM_BASE_URL'),    // "https://api.clod.io/v1"
  apiKey: config.get('CLOD_API_KEY'),
  fastModel: config.get('LLM_FAST_MODEL'), // "DeepSeek V3"
  deepModel: config.get('LLM_DEEP_MODEL'), // "DeepSeek V3"
};

// Falls back to mock automatically when no API key is set
const client = llmConfig.apiKey ? createClient(llmConfig) : createMockClient();
```

## Functions

### `warmup(client, config) → Promise<void>`

Call once on app startup. Pre-warms the HTTPS connection and validates the API key. **Never throws** — logs a warning on failure and resolves.

### `score(text, client, config) → Promise<ScoreJSON>`

Scores input text on 5 quality dimensions. Uses `config.fastModel` at temperature 0.

### `optimize(text, scoreResult, client, config) → Promise<OptimizedJSON>`

Rewrites text to improve the weakest scoring dimensions. Uses `config.deepModel` at temperature 0.2.

## Data Shapes

### ScoreJSON

```json
{
  "clarity": 3.3,
  "specificity": 1.7,
  "safety": 5.0,
  "tone": 4.2,
  "actionability": 2.0,
  "total": 3.24,
  "summary": "Text is vague and lacks specific details"
}
```

All dimension values are numbers in range **0.0–5.0**. `total` is the average of the 5 dimensions. `summary` is a one-line string explanation.

### OptimizedJSON

```json
{
  "optimizedText": "The improved version of the text...",
  "changes": [
    "Added specific details to replace vague references",
    "Clarified the timeline from 'soon' to 'by Friday'"
  ]
}
```

`optimizedText` is the rewritten string. `changes` is an array of strings describing what was improved.

## Error Behavior

**Backend-2 never throws.** Every function always resolves with a valid object.

| Function | On failure returns |
|---|---|
| `score()` | All dimensions 3.0, total 3.0, summary "Unable to score" |
| `optimize()` | Original text unchanged, empty changes array |
| `warmup()` | Resolves silently (logs warning) |

Backend-1 does **not** need try/catch around these calls. The UI always receives displayable data.

## Config Keys

Backend-2 requires these 4 values (passed via the `config` object, or read from `.env`):

| Key | Example | Purpose |
|---|---|---|
| `CLOD_API_KEY` | `clod_...` | CLōD API authentication |
| `LLM_BASE_URL` | `https://api.clod.io/v1` | LLM endpoint |
| `LLM_FAST_MODEL` | `DeepSeek V3` | Model for scoring (fast, temp 0) |
| `LLM_DEEP_MODEL` | `DeepSeek V3` | Model for optimization (quality, temp 0.2) |
| `LLM_CHAT_MODEL` | *(optional)* | Multi-turn **Send** assistant in mock input strip; defaults to `LLM_DEEP_MODEL` when unset |

### Related repo docs

- **`AGENT_CONTEXT.md`** — real directory layout, IPC table, hotkeys, dual mock UI & forward bridge, known gaps.
- Runtime behavior may add channels beyond this contract; keep **INTEGRATION_CONTRACT** in sync when **public** LLM shapes change.

## Threshold Logic

Backend-2 returns scores. Backend-1 decides whether to call `optimize()`:

```javascript
const scoreResult = await score(selectedText, client, llmConfig);
if (scoreResult.total < SCORE_THRESHOLD) {
  const optimized = await optimize(selectedText, scoreResult, client, llmConfig);
  // show optimized text in UI
}
```

The threshold value, demo mode bypass, and force-trigger logic all live in Backend-1.
