# Backend-2: AI Logic Layer Implementation Plan (CLōD Edition)

## Project Context

"The Shrink" is a hackathon Electron app that captures selected text, scores it on 5 quality dimensions, and offers an optimized version if the score is below a threshold. Backend-2 owns the entire AI logic -- provider-agnostic, no Electron dependencies, clean interfaces.

The repo is currently empty (docs only). All Backend-2 code goes under `src/`.

**LLM Provider: CLōD** ([clod.io](https://clod.io)) -- an OpenAI-compatible API gateway that proxies 30+ models (including DeepSeek V3, GPT-4o, Llama 3.1 8B) through a single endpoint and API key.

---

## CLōD API -- Confirmed Details

- **Base URL:** `https://api.clod.io/v1`
- **Endpoint:** `POST /v1/chat/completions`
- **Auth header:** `Authorization: Bearer <CLOD_API_KEY>`
- **100% OpenAI SDK compatible** -- use `openai` npm package, just change `baseURL`
- **Free tier:** 100 requests/day (auto-replenished at midnight) -- enough for dev, be mindful during stability tests
- **Key parameter:** `max_completion_tokens` (not `max_tokens`)
- **Available models (confirmed in docs):**
  - `DeepSeek V3` -- 128K context, free tier, fast, strong JSON compliance (our primary model)
  - `GPT 4o` -- third-party proxy via CLōD, 5% routing fee, best quality fallback
  - `Llama 3.1 8B` -- free, very fast, smaller but good for warmup

**Node.js pattern from CLōD docs:**

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.clod.io/v1",
  apiKey: process.env.CLOD_API_KEY,
});

const completion = await client.chat.completions.create({
  model: "DeepSeek V3",
  messages: [{ role: "user", content: "Hello" }],
});
```

---

## File Structure

```
src/
  llm/
    client.js          # LLMClient class wrapping openai SDK
    mock-client.js     # Mock implementation (hardcoded JSON, no API needed)
  scorer.js            # score(text) -> ScoreJSON
  optimizer.js         # optimize(text, scoreResult) -> OptimizedJSON
  schema.js            # Manual validation for ScoreJSON & OptimizedJSON
  fallback.js          # Safe default objects on parse failure
  warmup.js            # One-shot LLM warmup on app start
  prompts/
    scoring.js         # Checklist-based scoring prompt template
    optimization.js    # Optimization prompt template
  index.js             # Public API entry point
tests/
  stability-test.js    # 20-run stability script
  fixtures.js          # 2 demo prompts (vague + danger)
.env.example           # CLōD defaults
package.json           # openai + dotenv
```

---

## 5 Scoring Dimensions

Each dimension scored **0.0 -- 5.0** (0 = terrible, 5 = excellent). A `total` field is the average.

- **Clarity** -- Is the text unambiguous and easy to understand?
- **Specificity** -- Does it include concrete details rather than vague generalities?
- **Safety** -- Is it free from harmful, dangerous, or policy-violating content?
- **Tone** -- Is the tone appropriate, professional, and constructive?
- **Actionability** -- Can someone act on this text effectively?

These align with the test cases: "vague" text scores low on Specificity/Actionability; "danger" text scores low on Safety.

---

## Phase 1: Foundation

### 1a. package.json -- dependencies

```json
{
  "name": "the-shrink-brain",
  "type": "module",
  "dependencies": {
    "openai": "^4.x",
    "dotenv": "^16.x"
  },
  "scripts": {
    "test:stability": "node tests/stability-test.js",
    "test:quick": "node tests/stability-test.js --runs=3"
  }
}
```

Only 2 runtime deps. The `openai` package handles all HTTP, retries, streaming, error types, and is officially supported by CLōD. No raw `fetch` needed.

### 1b. src/llm/client.js -- LLMClient class

Thin wrapper around the `openai` SDK:

```javascript
import OpenAI from "openai";

export function createClient(config) {
  const openai = new OpenAI({
    baseURL: config.baseURL,   // https://api.clod.io/v1
    apiKey: config.apiKey,     // CLOD_API_KEY
  });

  return {
    async call(model, messages, { temperature = 0, maxTokens = 1024 } = {}) {
      const res = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
      });
      return res.choices[0].message.content;
    }
  };
}
```

- Uses `max_completion_tokens` (CLōD / OpenAI current standard)
- Provider-agnostic: change `baseURL` + `apiKey` in `.env` to switch to OpenAI, Anthropic proxy, etc.
- The `openai` SDK handles rate limit retries, timeout errors, and connection pooling automatically

### 1c. src/llm/mock-client.js -- Mock for Backend-1 dev

Same `{ call }` interface, returns hardcoded JSON strings matching ScoreJSON/OptimizedJSON shapes. Backend-1 can integrate and test without any API key.

### 1d. src/schema.js -- Validation

Manual validation (no extra library):

```javascript
// ScoreJSON
{ clarity, specificity, safety, tone, actionability, total, summary }
// all numbers 0-5, summary is string

// OptimizedJSON
{ optimizedText, changes }
// optimizedText is string, changes is string[]
```

`validateScore(obj)` and `validateOptimized(obj)` return `{ valid: boolean, data, errors }`.

### 1e. src/fallback.js -- Safe defaults

- `getDefaultScore()` -- all dimensions 3.0, summary "Unable to score"
- `getDefaultOptimization(originalText)` -- returns original text unchanged, empty changes
- Guarantees the app **never crashes** on LLM failure

---

## Phase 2: Scoring

### 2a. src/prompts/scoring.js -- Checklist prompt

System prompt structure:

```
You are a text quality evaluator. Score the following text on 5 dimensions (0.0-5.0).

For each dimension, apply this checklist:

## Clarity (score 0-5)
- [ ] Every sentence has a single clear subject
- [ ] No ambiguous pronouns (it, this, that) without clear referents
- [ ] Technical terms are used correctly or explained
- [ ] Score: count YES answers. 0/3 = 0.0, 1/3 = 1.7, 2/3 = 3.3, 3/3 = 5.0

## Specificity ...
## Safety ...
## Tone ...
## Actionability ...

Respond ONLY with valid JSON: { "clarity": N, "specificity": N, ... "total": avg, "summary": "..." }
```

The checklist approach with explicit scoring rubrics is the **single biggest lever for stability**. Each yes/no criterion removes subjective judgment.

### 2b. src/scorer.js -- score(text)

```javascript
export async function score(text, client, config) {
  // 1. Build messages from scoring prompt template + input text
  // 2. Call client.call("DeepSeek V3", messages, { temperature: 0, maxTokens: 512 })
  // 3. Parse JSON, validate with schema
  // 4. On failure: retry once, then fallback
  // return ScoreJSON
}
```

- **Model: `DeepSeek V3`** -- fast, free on CLōD, strong JSON output compliance
- **Temperature: 0** -- deterministic scoring
- **maxTokens: 512** -- score JSON is small, saves tokens and latency
- Strips markdown fences from response before parsing (LLMs sometimes wrap JSON in ```json blocks)

---

## Phase 3: Optimization

### 3a. src/prompts/optimization.js

```
You are a text improvement specialist. Given the original text and its quality scores,
rewrite the text to improve the weakest dimensions while preserving the author's intent.

Focus especially on dimensions scoring below 3.0.

Respond ONLY with valid JSON: { "optimizedText": "...", "changes": ["...", "..."] }
```

### 3b. src/optimizer.js -- optimize(text, scoreResult)

```javascript
export async function optimize(text, scoreResult, client, config) {
  // 1. Build messages: system prompt + user message with text + scores
  // 2. Call client.call("DeepSeek V3", messages, { temperature: 0.2, maxTokens: 1024 })
  // 3. Parse, validate, fallback on failure
  // return OptimizedJSON
}
```

- **Model: `DeepSeek V3`** (same model, adequate quality for hackathon; can switch to `GPT 4o` via .env if needed)
- **Temperature: 0.2** -- slight creativity for natural rewriting
- **maxTokens: 1024** -- optimized text may be longer than original

---

## Phase 4: Warmup + Stability Testing

### 4a. src/warmup.js

```javascript
export async function warmup(client, config) {
  // Sends "Say OK" to Llama 3.1 8B (cheapest/fastest model)
  // Pre-warms HTTPS connection to api.clod.io
  // Validates API key works
  // Fails silently -- logs warning, does not block app
}
```

Uses `Llama 3.1 8B` for warmup (fastest, cheapest, just testing the pipe).

### 4b. tests/fixtures.js -- Demo prompts

Two hardcoded test inputs:
- **Vague:** "Can you help me with the thing we talked about? I need it done soon and it should be good."
- **Danger:** Text with unsafe/policy-violating content (exact content TBD, something that clearly trips Safety)

### 4c. tests/stability-test.js

```
node tests/stability-test.js          # 20 runs per fixture (default)
node tests/stability-test.js --runs=3 # quick smoke test (6 requests total)
```

- Runs each fixture through `scorer.score()` N times
- Outputs per-run scores in a table + summary stats (mean, std dev, min, max)
- **Pass criteria:** vague total < 2.5 (all runs), danger total < 1.0 (all runs)
- **Rate limit awareness:** 20 runs x 2 fixtures = 40 requests. Free tier allows 100/day, so one full stability run uses 40%. The `--runs=3` quick mode uses only 6 requests for iterating on prompts.
- If failing: tighten checklist criteria in scoring prompt and re-run

---

## Phase 5: Integration + Entry Point

### 5a. .env.example

```
# CLōD (default -- hackathon primary)
CLOD_API_KEY=your_clod_api_key_here
LLM_BASE_URL=https://api.clod.io/v1
LLM_FAST_MODEL=DeepSeek V3
LLM_DEEP_MODEL=DeepSeek V3

# To switch to OpenAI, change these 3 lines:
# LLM_BASE_URL=https://api.openai.com/v1
# CLOD_API_KEY=sk-your-openai-key
# LLM_FAST_MODEL=gpt-4o-mini
# LLM_DEEP_MODEL=gpt-4o
```

### 5b. src/index.js -- Public API

```javascript
import 'dotenv/config';
import { createClient } from './llm/client.js';
import { createMockClient } from './llm/mock-client.js';
import { score } from './scorer.js';
import { optimize } from './optimizer.js';
import { warmup } from './warmup.js';

const config = {
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.CLOD_API_KEY,
  fastModel: process.env.LLM_FAST_MODEL,
  deepModel: process.env.LLM_DEEP_MODEL,
};

const client = config.apiKey ? createClient(config) : createMockClient();

export { score, optimize, warmup, client, config };
```

Backend-1 imports from this file. If no API key is set, it automatically falls back to mock client.

### 5c. Backend-1 Interface Contract

Backend-1 calls these 3 functions (and nothing else):

```javascript
import { score, optimize, warmup, client, config } from './src/index.js';

await warmup(client, config);
const scoreResult = await score(selectedText, client, config);
const optimized = await optimize(selectedText, scoreResult, client, config);
```

---

## Rate Limit Strategy (CLōD Free Tier: 100 req/day)

- **Normal app usage:** 2 requests per interaction (1 score + 1 optimize) = ~50 interactions/day -- sufficient for demo
- **Stability test (full):** 40 requests -- run at most twice per day
- **Stability test (quick):** 6 requests -- use during prompt iteration
- **Warmup:** 1 request on app start
- If free tier runs out mid-demo: either top up CLōD wallet, or flip `.env` to OpenAI as instant fallback

---

## Key Design Decisions

- **`openai` npm package** -- officially supported by CLōD, handles retries/errors/connection pooling; no raw fetch
- **`DeepSeek V3`** as both fast and deep model -- 128K context, free on CLōD, strong JSON compliance. Can split to `GPT 4o` for deep model via .env if quality needs increase
- **Plain JS (ESM)** -- hackathon speed, `"type": "module"` in package.json
- **2 deps only** -- `openai` + `dotenv`
- **Mock-first** -- everything works without an API key; Backend-1 never blocked
- **Checklist prompts** -- explicit boolean criteria per dimension, mapped to numeric scores; biggest stability lever
- **Retry + fallback** -- 1 retry on parse failure, then safe default; app never crashes
- **Provider switchable in 10 seconds** -- change 3 lines in `.env` to go from CLōD to OpenAI or back
