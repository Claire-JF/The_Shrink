# Agent context — repo state & how to extend

> **Audience:** Humans or downstream agents picking up implementation. Read this **before** trusting older narrative-only docs verbatim.
>
> **Last aligned with codebase:** Electron hover widget + Windows UI Automation selection (with clipboard fallback) + protected-region optimize + `main.js` loads `.env` from repo root.

## One-liners

| Surface | Purpose |
|---------|---------|
| **Hover widget** | Global capture + score pipeline. User selects text elsewhere, presses **Ctrl+R** → selection is read → Backend-2 **`score`** → widget shows; user may mark **protected spans** in the original column before **Generate** → **`optimize`** with `{ protectedRegions }`. |
| **Replace selection** | After Generate, pastes optimized text into the app that had focus at capture time (Windows: HWND + Ctrl+V; else clipboard + close). |
| **Backend-2 (`src/`)** | Pure ESM JS: **`score`** / **`optimize`**, optional **`{ protectedRegions }`**, **`warmup`** / **`chat`**, OpenAI-compat **`createClient`** + **`createMockClient`**. Loaded via **`backend1/brain.js`** dynamic `import()`. |

**No standalone HTTP backend server.** All LLM traffic is Electron main → CLōD (or Mock).

**Legacy / unused in main flow:** `renderer/mock-*.html` (old dual-shell experiment) is not registered by the main process; IPC channels for that shell were removed.

---

## How to run (Windows-first)

```bash
npm install
npm start
```

- **`npm run verify`** — short smoke (sets `VERIFY_BACKEND1` / `MOCK_SELECTION`).
- **`npm run test:mock`** / **`npm run test:quick`** — Backend-2 unit-style checks (see `package.json`).
- **Env vars:** see **`.env.example`** — `CLOD_API_KEY`, `LLM_*`, optional `LLM_CHAT_MODEL`, `MOCK_SELECTION`, `DEMO_MODE`, **`DISABLE_UIA_SELECTION`**, `SCORE_EXPAND_THRESHOLD`, etc. Electron loads **`.env`** from the directory containing **`main.js`** (`require('dotenv').config({ path: path.join(__dirname, '.env') })`).

---

## Hotkeys (Electron `globalShortcut`)

| Accelerator | Behavior |
|-------------|-----------|
| **Ctrl+R** (`CommandOrControl+R`) | Primary shrink trigger — run capture + score → show hover widget (see **focus order** below). |
| **Ctrl+Alt+R** / **Ctrl+Shift+R** (Windows fallbacks) | Same as shrink if the first binding failed to register (another app seized **Ctrl+R**). |
| **Ctrl+Shift+S** (+ extra fallbacks on Windows) | Forced pipeline (threshold bypass). |
| **Ctrl+Shift+D** | Toggle demo mode (DEMO badge; threshold gating still computed for logging). |

> **Historical doc drift:** Older specs say **Cmd+T**. Team aligned on **`Ctrl+R`** / **`CommandOrControl+R`** (macOS uses Cmd).

**Focus / timing:** The main process runs **`runCaptureFlow` (selection + score) before the first `showWindow`** so the **foreground app keeps focus** for selection read (UI Automation or Ctrl+C). Do not reintroduce “show loading widget before capture” without revisiting this.

---

## Selection capture (Windows)

Implemented in **`backend1/selection.js`**:

1. **UI Automation (preferred):** **`scripts/win-selection-uia.ps1`** uses **`TextPattern.GetSelection()`** on **`AutomationElement.FocusedElement`** — **no clipboard mutation**. Returns UTF-8 via Base64 on stdout.
2. **Fallback:** Classic flow — snapshot clipboard → PowerShell **SendKeys `^c`** → read clipboard → restore (**`sourceApp: 'clipboard-copy'`**).
3. **`MOCK_SELECTION=1`** or config **`mockSelection`**: stub text, no OS calls.

Set **`DISABLE_UIA_SELECTION=1`** in `.env` to skip UIA and always use the clipboard copy path (debugging / app compatibility).

**Non-Windows:** real capture is not wired; use **`MOCK_SELECTION=1`** or expect **`PLATFORM_UNSUPPORTED`**.

**Limitations:** UIA works when the focused control exposes **TextPattern** (many editors, browsers). Terminals, some games, and non-accessible UIs often return empty → automatic clipboard fallback.

---

## Protected regions (optimize)

- **Frontend:** User drag-selects **verbatim keep** spans on the Original panel; offsets are sent as **`protectedRegions: [{ start, end }]`** (UTF-16 indices, half-open) with **`shrink:generate-optimized`**.
- **Backend-2:** **`optimize(text, scoreResult, client, config, { protectedRegions })`**. Prompts use **`<<PROTECTED>>…<</PROTECTED>>`** markers; output is stripped of stray markers; **`safety < 2.0`** forces **safety override** (ignore protections) in code. See **`temp/PROTECTED_REGIONS_SPEC.md`** for narrative detail.

---

## Directory map (truth)

```
main.js                     # Electron entry; require('dotenv').config({ path: join(__dirname, '.env') })
preload.js                  # contextBridge → window.shrink
backend1/
  index.js                  # init; hotkeys — runCaptureFlow BEFORE first show (focus-safe)
  window.js / hotkey.js     # Hover BrowserWindow + globalShortcut (+ Windows shrink fallbacks)
  selection.js              # Win: UIA selection → else clipboard ^c snapshot
  ipc.js                    # ipcMain handlers
  brain.js                  # Dynamic import Backend-2; optimize options passthrough
  win-foreground-hwnd.js    # HWND snapshot + paste helper (Replace)
  clipboard.js config.js logger.js state.js
  prefs.js                  # `%AppData%/the-shrink/shrink-ui-prefs.json`
  forward-prompt.js         # Clipboard + optional Windows foreground + paste bridge
renderer/
  index.html app.js styles.css
scripts/
  win-selection-uia.ps1     # UI Automation TextPattern selection (no clipboard)
  win-paste-foreground.ps1  # Activate HWND + ^v (Replace)
  win-forward-paste.ps1     # Forward prompt to external app
src/
  index.js                  # score, optimize, warmup, chat, re-exports
  protected-regions.js      # normalize regions, safety threshold, reconcile spans, strip markers
  optimizer.js prompts/ schema.js …
  llm/client.js mock-client.js
```

---

## IPC & preload APIs (minimal contract)

Preload exposes **`window.shrink`** (see **`preload.js`** / **`backend1/ipc.js`** `CHANNEL`):

| Invoke | Payload / behavior |
|--------|---------------------|
| `shrink:capture-selection` | `{ forced? }` — selection + Backend-2 **`score`** |
| `shrink:generate-optimized` | **`{ protectedRegions?: { start, end }[] }`** — **`optimize`** with optional regions |
| `shrink:copy-to-clipboard` | `{ text? }` |
| `shrink:replace-with-optimized` | Clipboard + optional Windows paste + hide widget |
| `shrink:close-widget` | Hide hover |
| `shrink:get-state` / `get-config` | Session / config |
| `shrink:open-log` | Open log file |
| `shrink:score-live` | `{ text }` — ad hoc **`score`** |
| `shrink:chat-send` | `{ text }` — **`chat`** turn |
| `shrink:forward-prompt` / forward prefs | External paste bridge |

`shrink:presentation` (main → renderer) carries **`loading`**, **`capture`**, **`config`** payloads.

---

## Scoring shapes

Implementation follows **[INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md)**:

| Field | Meaning |
|-------|---------|
| `clarity`, `emotionalBalance`, `safety` | **Each 0–5** |
| `total` | Mean of dimensions |
| `summary` | One-line rationale |

Optimized payload includes **`optimizedText`**, **`changes[]`**, optional **`safetyOverride`**, **`protectedRegions`** (see contract).

---

## Forward-to-external-AI

- **Windows:** `scripts/win-forward-paste.ps1` — activate host + **Ctrl+V**.
- **Fallback:** clipboard only off-Windows.
- Code: **`forward-prompt.js`**.

---

## Backend-1 ↔ Backend-2 wiring

```text
brain.js ──(import)──► src/index.js
                ├► createClient(llmConfig) vs createMockClient() if no CLOD_API_KEY
                └► score(text) | optimize(text, score, { protectedRegions? }) | chat | warmup
```

---

## Open gaps / sane next tickets

| Item | Notes |
|------|------|
| **macOS/Linux selection** | No UIA path; use **`MOCK_SELECTION=1`** or add native capture later |
| **UI Automation coverage** | Some apps never expose **TextPattern** → clipboard fallback |
| **Nia / streaming** | Not in current branch |
| **Security** | PowerShell paste / wrong-window risk — UX caution |

---

## Doc map (truth vs archive)

| File | Weight |
|------|--------|
| **AGENT_CONTEXT.md** (this) | Executable truth for navigation |
| **INTEGRATION_CONTRACT.md** | Backend-2 API + JSON envelopes |
| **temp/PROTECTED_REGIONS_SPEC.md** | Protected regions narrative |
| **SPEC_CLIPBOARD.md** / **TECH_ARCHITECTURE.md** | Historical — verify against this file + code |
| **README.md** | Quick start + doc links |

---

## Handoff checklist for a new coding agent

1. Read **`AGENT_CONTEXT.md`** + **`INTEGRATION_CONTRACT.md`**.
2. Run **`npm install`**, **`npm run verify`**, optional **`npm run test:mock`**.
3. Trace **`preload.js`** → **`ipc.js`** → **`brain.js`** → **`src/index.js`**.
4. Before changing optimize/score shapes, grep **`renderer/`**, **`ipc.js`**, **`tests/`**.
