# Agent context — repo state & how to extend

> **Audience:** Humans or downstream agents picking up implementation. Read this **before** trusting older narrative-only docs verbatim.
>
> **Last aligned with codebase:** Electron + Backend-2 ESM bridge + dual mock shell + Windows forward path (see git history).

## One-liners

| Surface | Purpose |
|---------|---------|
| **Hover widget** | Global capture + score pipeline (original product loop). User selects text elsewhere, presses hotkey → widget opens. |
| **Mock dual shell (`Ctrl+Shift+W`)** | Product experiment: Claude-style bottom **input strip** + top-right translucent **orb**; optional **live scoring** inside the strip; **Send** forwards to external apps + triggers in-app assistant chat. |
| **Backend-2 (`src/`)** | Pure ESM JS: `score` / `optimize` / `warmup` / **`chat`** + OpenAI-compat `createClient` + in-process **`createMockClient`**. Loaded from main via **`backend1/brain.js`** dynamic `import()`. |

**No standalone HTTP backend server.** All LLM traffic is Electron main → CLōD (or Mock).

---

## How to run (Windows-first)

```bash
npm install
npm start
```

- **`npm run verify`** — short smoke (sets `VERIFY_BACKEND1` / `MOCK_SELECTION`).
- **Env vars:** see `.env.example` — notably `CLOD_API_KEY`, `LLM_*`, optional `LLM_CHAT_MODEL`, `MOCK_SELECTION`, `DEMO_MODE`.

---

## Hotkeys (Electron `globalShortcut`)

| Accelerator | Behavior |
|-------------|-----------|
| **Ctrl+R** (`CommandOrControl+R`) | Shrink hover widget: capture selection → score (Backend-2) → show if thresholds allow |
| **Ctrl+Shift+S** (+ Windows fallbacks if busy) | Forced pipeline (threshold bypass) |
| **Ctrl+Shift+D** | Toggle demo-mode (always expand thresholds) |
| **Ctrl+Shift+W** | Open **dual mock UI**: bottom input strip + orb (360-style) |

> **Historical doc drift:** Older specs say **Cmd+T**. Team aligned globally on **`Ctrl+R`** for shrink trigger (same `CommandOrControl` semantics on macOS).

---

## Directory map (truth)

```
main.js                     # Electron entry, single-instance
preload.js                  # contextBridge → window.shrink, window.mockShell
backend1/
  index.js                  # init: logger → brain.initBrain → ipc → shortcuts
  window.js / hotkey.js     # Hover BrowserWindow + globalShortcut
  selection.js             # WIN32: clipboard save → PowerShell SendKeys ^c → restore
  ipc.js                   # ipcMain handlers (see table below)
  brain.js                  # Dynamic import Backend-2; client factory
  clipboard.js config.js logger.js state.js
  mock-placeholder-shell.js # Dual windows coordinator
  prefs.js                  # `%AppData%/the-shrink/shrink-ui-prefs.json`
  forward-prompt.js       # Clipboard + optional Windows foreground + paste bridge
renderer/
  index.html app.js styles.css       # Hover widget UI
  mock-input-bar.* mock-orb.*
  live-heuristic.js mock-live-debounce.js
scripts/
  win-forward-paste.ps1             # Activate host process + Ctrl+V best-effort
src/
  package.json            # { "type": "module" } — subdirectory ESM boundary
  index.js                # score, optimize, warmup, chat, re-exports client factories
  llm/client.js mock-client.js
```

Legacy flat names in **SPEC_CLIPBOARD.md** / **TECH_ARCHITECTURE.md** (`main.js` only roots, separate `selection.js`) were **planned layout** — code is **`backend1/*` + grouped renderer assets**.

---

## IPC & preload APIs (minimal contract)

Preload exposes **`window.shrink`**:

| Invoke / pattern | Payload / behavior |
|------------------|-------------------|
| `shrink:capture-selection` | `{ forced? }` — selection + Backend-2 score |
| `shrink:generate-optimized` | state-driven optimize |
| `shrink:copy-to-clipboard` | `{ text? }` |
| `shrink:score-live` | `{ text }` — live/workbench strip scoring |
| `shrink:chat-send` | `{ text }` — append user + assistant in `state`, call Backend-2 **`chat`** |
| `shrink:forward-prompt` | merges UI prefs (`forwardTarget`) + pushes clipboard + PS paste bridge |
| `shrink:getForwardPrefs` / `setForwardPrefs` | Persist forward target dropdown |
| `mock-ui:*` sizing / dismiss via **`window.mockShell`** | telemetry fan-out to orb, bar resize |

Main also listens **`ipcMain.on('mock-ui:telemetry')`** → orb Broadcast.

Complete list maintained in **`backend1/ipc.js`** `CHANNEL`.

---

## Scoring shapes (⚠ divergence from SPEC narrative)

Implementation follows **[INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md)** (Backend-2 handoff):

| Field | Meaning |
|-------|---------|
| `clarity`, `specificity`, `safety`, `tone`, `actionability` | **Each 0–5** |
| `total` | Mean of dimensions |
| `summary` | One-line rationale |

Older **SPEC_CLIPBOARD.md** / **TECH_ARCHITECTURE.md** sections describe **`task_verb`/`scope`/…/`flags`** (0–1 scale) — that is **not** what the wired UI + Backend-2 entry returns today. When reconciling demos, prioritize **INTEGRATION_CONTRACT** + **renderer UI** rendering code.

Optimized JSON in live code: **`optimizedText` + `changes[]`** (`camelCase`); legacy **`optimized_text`** tolerated for Copy path.

---

## Forward-to-external-AI (“one tap after Send”)

- **Windows-only automation:** `scripts/win-forward-paste.ps1` activates process main window (`Cursor`, `Claude`, …) → `Ctrl+V`.
- Fallback is **always clipboard** — safe cross-platform semantics.
- **Custom** preset: PowerShell resolves arbitrary **`.exe`-less process base name**.
- Targets list + heuristic process map live in **`forward-prompt.js`** + **`win-forward-paste.ps1`** — update both if rebranding installers rename EXEs.

---

## Backend-1 ↔ Backend-2 wiring

```text
brain.js ──(import)──► src/index.js
                ├► createClient(llmConfig) vs createMockClient() if no CLOD_API_KEY
                └► score(text) | optimize(sel,score) | chat(history) | warmup
```

Warmup executes even for mocks (cheap path). Conversation model defaults to **`LLM_CHAT_MODEL`** or **`LLM_DEEP_MODEL`**.

When extending Backend-2:

- Preserve **never-throw guarantee** documented in Integration Contract OR align error surfacing consciously.
- If adding streaming, coordinate UI + IPC buffering (not implemented).

---

## Open gaps / sane next tickets

| Item | Notes |
|------|------|
| **macOS/Linux forward bridge** | Only clipboard copied today off-Windows |
| **`robotjs`/AppleScript** | Not wired in this branch — Windows-only capture path deliberate |
| **Score dimension reconciliation** | Marketing SPEC vs Backend-2 contract intentional drift — pick canonical before tournament story |
| **Nia integration** | Spec P1 checkpoint — untouched in scaffolding |
| **Streaming chat** | `chat()` is single completion |
| **Security review** | PowerShell elevate / wrong-window paste risk — UX warning recommended |

---

## Doc map (truth vs archive)

| File | Weight |
|------|--------|
| **AGENT_CONTEXT.md** (this) | Executable truth for codebase navigation |
| **INTEGRATION_CONTRACT.md** | Backend-2 API + JSON envelopes |
| **SPEC_CLIPBOARD.md** | Narrative UX + demos + historical dimension names ❗ outdated on schema |
| **TECH_ARCHITECTURE.md** | Original division-of-labor + risks — partially superseded architecture notes |
| **task_for_backend.txt** | Early Backend-1/2 split memo — overlaps with AGENT_CONTEXT |

---

## Handoff checklist for a new coding agent

1. Read **`AGENT_CONTEXT.md`** + **`INTEGRATION_CONTRACT.md`**.
2. Run **`npm install`**, **`npm start`**, **`Ctrl+Shift+W`** inspect dual UI & **`npm run verify`** baseline.
3. Trace one IPC path in **`preload.js`** → **`ipc.js`** → **`brain.js`** → **`src/index.js`**.
4. Before flipping schema in docs, grep **`renderer/`** & **`ipc.js`** consumers.
