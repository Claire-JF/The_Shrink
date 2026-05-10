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
  fastModel: config.get('LLM_FAST_MODEL'), // "Qwen2.5 7B"
  deepModel: config.get('LLM_DEEP_MODEL'), // "Qwen2.5 72B"
};

// Falls back to mock automatically when no API key is set
const client = llmConfig.apiKey ? createClient(llmConfig) : createMockClient();
```

## Functions

### `warmup(client, config) → Promise<void>`

Call once on app startup. Pre-warms the HTTPS connection and validates the API key. **Never throws** — logs a warning on failure and resolves.

### `score(text, client, config) → Promise<ScoreJSON>`

Scores input prompt on 3 quality dimensions. Uses `config.fastModel` (Qwen2.5 7B) at temperature 0.

### `optimize(text, scoreResult, client, config) → Promise<OptimizedJSON>`

Rewrites prompt to improve the weakest scoring dimensions. Uses `config.deepModel` (Qwen2.5 72B) at temperature 0.2. Always called on user action (no threshold gating).

## Data Shapes

### ScoreJSON

```json
{
  "clarity": 1.3,
  "safety": 5.0,
  "emotionalBalance": 5.0,
  "total": 3.77,
  "summary": "Prompt is vague and lacks specific details or context"
}
```

| Field | Type | Range | Meaning |
|---|---|---|---|
| `clarity` | number | 0.0–5.0 | Higher = clearer, more specific, more actionable |
| `safety` | number | 0.0–5.0 | Higher = safer, no harmful/irreversible requests |
| `emotionalBalance` | number | 0.0–5.0 | Higher = more objective, no emotional manipulation |
| `total` | number | 0.0–5.0 | Average of the 3 dimensions |
| `summary` | string | — | One sentence explaining the main issue |

### OptimizedJSON

```json
{
  "optimizedText": "The improved version of the prompt...",
  "changes": [
    "Added specific details to replace vague references",
    "Removed threatening language and restated request factually"
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

## Flow

```
User selects text → presses Cmd+T → Backend-1 calls score()
→ UI displays 3 scores
→ User presses "Generate" → Backend-1 calls optimize()
→ UI displays optimized text + changes
→ User clicks "Copy" → Backend-1 writes to clipboard
```

Optimization is **always user-triggered**. No threshold gating — Backend-1 just shows scores and lets the user decide.

## Config Keys

| Key | Example | Purpose |
|---|---|---|
| `CLOD_API_KEY` | `eyJ...` | CLōD API authentication |
| `LLM_BASE_URL` | `https://api.clod.io/v1` | LLM endpoint |
| `LLM_FAST_MODEL` | `Qwen2.5 7B` | Model for scoring (fast, temp 0) |
| `LLM_DEEP_MODEL` | `Qwen2.5 72B` | Model for optimization (quality, temp 0.2) |
