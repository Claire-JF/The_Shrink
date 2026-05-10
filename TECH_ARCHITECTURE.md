# The Shrink — Technical Architecture & Division of Labor

> **Living implementation map:** **[AGENT_CONTEXT.md](AGENT_CONTEXT.md)** — includes Windows **UI Automation** selection (fallback **Ctrl+C**), **protected-region optimize**, removal of the old **Ctrl+Shift+W** dual-shell from the main process, and current IPC. When this file disagrees with **AGENT_CONTEXT** / **INTEGRATION_CONTRACT**, trust those.

> **Hackathon:** Cursor Hackathon Vancouver, May 10, 2026
> **Repo:** https://github.com/Claire-JF/The_Shrink
> **Submission cutoff:** 18:00 (hard, no exceptions)
> **Tournament format:** 40 → 8 → 4 → 1, live head-to-head demos
> **Spec:** see [SPEC_CLIPBOARD.md](SPEC_CLIPBOARD.md) for product spec

**Product (single-line):** Select any text, hit the global shortcut (**Ctrl+R**, `CommandOrControl+R` on current builds), get an instant agent-ready rewrite. The missing keyboard layer for the agent era.

---

## File status (active set)

| File | Purpose |
|------|---------|
| **`AGENT_CONTEXT.md`** | **Current implementation map** for developers / agents (IPC, dirs, hotkeys, gaps) |
| `INTEGRATION_CONTRACT.md` | Backend-2 API + JSON envelopes actually wired in `src/` |
| `SPEC_CLIPBOARD.md` | Product spec — workflow, UI, demo scripts (**some schema names outdated vs Integration Contract**) |
| `TECH_ARCHITECTURE.md` | This file — original architecture narrative, division, milestones (**partially superseded**) |
| `AGENTS.md` | Legacy doc, contains observer-direction info — do not follow blindly |
| `HANDOFF.md` | Hourly team status updates |

The other docs in the project (`DAY_OF_WORKFLOW.md`, `PREP_CHECKLIST.md`, `SPONSOR_TOOLS.md`, `Stripe DESIGN.md`) remain reference. The `Context/` folder, `pitch-output/`, `Brand System Template.pptx` are archive — ignore.

When code and this document disagree, prefer **`AGENT_CONTEXT.md` + `INTEGRATION_CONTRACT.md`** for what actually ships.

---

## System architecture

```
┌──────────────────────────────────────────────────────────┐
│                    macOS — any app                       │
│   (ChatGPT, Cursor, Claude desktop, Notes, Slack, etc.)  │
│                                                          │
│   User selects text → presses Ctrl+R (CommandOrControl+R) │
└────────────────────────┬─────────────────────────────────┘
                         │ globalShortcut event
                         ▼
┌──────────────────────────────────────────────────────────┐
│                Electron Main Process                     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ selection.js                                       │  │
│  │   1. Save current clipboard                        │  │
│  │   2. Simulate copy (Windows PS SendKeys / future OS)│  │
│  │   3. Read new clipboard = selected text            │  │
│  │   4. Restore original clipboard                    │  │
│  └────────────────────────────────────────────────────┘  │
│                         │                                │
│                         ▼                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Backend-2 score() via src/index.js (fast model)     │  │
│  │   temperature: 0, returns 5-dim score JSON         │  │
│  └────────────────────────────────────────────────────┘  │
│                         │                                │
│                         ▼ IPC                            │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│           Electron Renderer (floating widget)            │
│                                                          │
│   State 1: render Original | Issues, score X.X / 5.0     │
│   User clicks "Generate"                                 │
│         │                                                │
│         ▼ IPC back to main                               │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│           Main Process (continued)                       │
│                                                          │
│   ┌────────────────────────────────────────────────┐    │
│   │ Backend-2 optimize() (deep model)                │    │
│   │   temperature: 0.2, returns rewritten text     │    │
│   └────────────────────────────────────────────────┘    │
│                         │                                │
│   [P1] If selectedText contains code identifier:         │
│   ┌────────────────────────────────────────────────┐    │
│   │ nia.js → fetch project context                 │    │
│   │   inject into optimizer prompt                 │    │
│   └────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼ IPC                            │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│           Renderer — State 2                             │
│                                                          │
│   Render Optimized side, score X.X → Y.Y                 │
│   Show [Copy] button                                     │
│   On Copy click → write optimized text to clipboard      │
└──────────────────────────────────────────────────────────┘
```

**No backend server.** Main process calls CLōD directly. No deploy step. Demo runs entirely on the laptop.

---

## Tech stack (locked)

| Component | Choice | Why |
|-----------|--------|-----|
| Desktop shell | Electron | Cross-team known, alwaysOnTop / globalShortcut built in |
| Hotkey | `globalShortcut` — **primary** `CommandOrControl+R`; **`Ctrl+Shift+W`** dual mock shell; `+S` forced; `+D` demo | Electron built-in |
| Selection capture | Win: PowerShell `[SendKeys]::SendWait('^c')`; mac path TBD | Repo currently **Windows-validated** (`backend1/selection.js`) |
| LLM API | CLōD (OpenAI-compatible) | Sponsor track + free credits |
| Fast model | TBD from clod.io/models — confirm by 11:30 | Used for scoring when the capture hotkey fires (+ live mock strip debounced) |
| Deep model | TBD from clod.io/models — confirm by 11:30 | Used for rewrite (called on Generate) |
| UI | Plain HTML/CSS/JS in renderer | No build step, faster iteration |
| IPC | `ipcMain.handle` / `ipcRenderer.invoke` | Standard Electron pattern |
| (P1) Context layer | Nia REST API | Sponsor track + grounding story |

**Window styling:** hover widget uses opaque rounded styling. The **mock orb** experiment uses `transparent: true` (Windows) — keep isolation from the main judging flow if focus issues appear.

---

## Data contracts

> **⚠ Live code path:** score/optimize payloads follow **[INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md)** (`clarity`, `specificity`, … on a **0–5** scale). The JSON examples in the next subsections are **legacy storyboard** retained for historical context only.

### Legacy score JSON (historical storyboard — not what `src/index.js` returns)

```json
{
  "task_verb": 0.4,
  "scope": 0.0,
  "success_criteria": 0.0,
  "context": 0.5,
  "risk": 1.0,
  "total": 1.9,
  "flags": [
    "Vague verb: 'help me'",
    "No scope defined",
    "No done condition",
    "Missing context"
  ],
  "model_used": "clod-fast-model-id"
}
```

**Validation:** every numeric field must be 0.0–1.0. `total` = sum of 5 dims (max 5.0). On parse failure, return safe fallback `{ total: null, flags: ["Analysis unavailable"] }` — do not crash UI.

### Legacy optimized output (historical — camelCase `optimizedText` is what ships)

```json
{
  "optimized_text": "Refactor signIn() in /src/auth/session.js ...",
  "fixed_dimensions": ["task_verb", "scope", "success_criteria", "context"],
  "model_used": "clod-deep-model-id"
}
```

### IPC channels

| Channel | Direction | Payload |
|---------|-----------|---------|
| `shrink:capture-selection` | renderer → main → renderer | trigger flow, returns score JSON |
| `shrink:generate-optimized` | renderer → main → renderer | takes selection + score, returns optimized JSON |
| `shrink:copy-to-clipboard` | renderer → main | writes optimized text to clipboard |
| `shrink:close-widget` | renderer → main | hide window |
| `shrink:score-live` | mock strip → main | `{ text }` live scoring |
| `shrink:chat-send` | mock strip → main | `{ text }` multi-turn assistant |
| `shrink:forward-prompt` | mock strip → main | Clipboard + Windows foreground paste bridge |
| `shrink:forward-prefs-get` / `…-set` | mock UI | persisted forward target dropdown |
| `mock-ui:resize-bar`, `mock-ui:dismiss-shell` | mock shell | layout helpers |
| Telemetry `mock-ui:telemetry` (send) / `mock-ui:orbit` (recv) | orb sync | **not** invoke API — event channel |

---

## Stability requirements (non-negotiable)

1. **Temperature 0** on scoring call. Variance kills the demo.
2. **Score 20× per demo prompt.** All 20 must be under 2.5 to guarantee the gap.
3. **CLōD failure = safe fallback**, never crash the renderer.
4. **Forced trigger hotkey** `Cmd+Shift+S` always opens widget regardless of score (last-resort demo fallback).
5. **`--demo-mode` flag** disables the score < 3.0 expansion threshold; widget always expands. Used during judging.
6. **CLōD warm-up call** at app startup. Avoids first-call cold latency on stage.

---

## Three-person division of labor

Roles are owners of code areas, not silos. Anyone can ask anyone for help.

---

### Person A — Electron shell + selection capture

**Owner of:** `main.js`, `preload.js`, `backend1/window.js`, `backend1/selection.js`, `backend1/config.js`, mock shell, forward bridge

**Tasks (priority order):**

1. **P0 / by 11:30** — Electron app boots, frameless rounded window, `alwaysOnTop: true`, draggable
2. **P0 / by 12:00** — `globalShortcut` registers **Ctrl+R** (`CommandOrControl+R`); pressing it opens the widget at cursor location
3. **P0 / by 12:30** — `backend1/selection.js` on Windows: clipboard round-trip + PowerShell `^c`; mac path still TBD vs spec
4. **P0 / by 13:00** — IPC bridge: renderer can call `shrink:capture-selection` and get back the captured text
5. **P0 / by 14:30** — Backend-2 scorer on shortcut: capture → score → IPC result to renderer
6. **P0 / by 15:00** — Esc and ✕ close widget; `Cmd+Shift+S` forced trigger; `--demo-mode` flag respected
7. **P1 / 16:00+** — clipboard write on Copy click, with verification that copy succeeded
8. **P2** — assist Person C with window positioning relative to selection cursor

**Critical conventions:**
- Window dimensions: ~620×320 px (room for two columns)
- **Do not** use `transparent: true`. Use opaque background with system rounded corners.
- Save and restore the user's original clipboard. We never clobber it without explicit Copy.
- Test selection capture in **at least 3 different apps** before declaring done.

**Known risk / platform:** This branch standardised on **PowerShell SendKeys** on Windows. **robotjs**/**AppleScript** flows in this document are **legacy options** for future macOS parity.

---

### Person B — CLōD integration + scoring/optimization

**Owner of:** `src/index.js` (+ `src/llm/*`), future `nia.js` (P1)

**Tasks (priority order):**

1. **P0 / by 11:30** — confirm two CLōD model IDs from clod.io/models. Pick a fast/cheap one and a stronger one.
2. **P0 / by 12:00** — `clod.js` wrapper working; one real call returns a parseable response. Implement warm-up call on app startup.
3. **P0 / by 12:30** — scoring prompt drafted with **explicit per-dimension checklist** (not free-form judgment). Test 5× on the same input — variance must be < 0.3 on total.
4. **P0 / by 13:30** — `scorer.js` returns valid JSON matching the schema. Safe fallback on parse failure.
5. **P0 / by 14:30** — optimization prompt drafted; `optimizer.js` returns rewritten text. Tested on the danger prompt (`"delete all..."`) and on the demo prompt (`"our login is broken..."`).
6. **P0 / by 15:30** — **Stability test:** run 20× on each demo prompt with `temperature: 0`. All 20 must score under 2.5 for the bad ones. If not, refine the scoring prompt's checklist.
7. **P1 / 14:00 checkpoint** — if MVP loop is solid, start Nia integration: detect file paths / identifiers → fetch context → inject into optimizer prompt
8. **P2** — instrument logging so demo can show which model handled each step

**Critical conventions:**
- Both models must be visibly named in the widget header (CLōD rubric: 40% is "model selection visible in demo").
- Scoring prompt must include negative examples (what NOT to score high) — this is the single biggest stability lever.
- `temperature: 0` on scoring; `0.2` on optimization (slight variation OK for rewriting).
- Never let an unparseable LLM response crash the app — always return a safe fallback object.

**Stability prompt template (start point):**
```
You are a strict input-quality grader for AI agents. Score the following user input on 5 dimensions, 0.0 to 1.0 each.

Input: """{text}"""

For each dimension, apply this checklist:

TASK_VERB: 1.0 if there's exactly one clear action verb. 0.5 if multiple but compatible. 0.0 if vague ("help me", "look at", "do something").
SCOPE: 1.0 if explicit boundary (file/module/range). 0.5 if implicit. 0.0 if open-ended.
SUCCESS_CRITERIA: 1.0 if measurable done condition. 0.5 if implied. 0.0 if absent.
CONTEXT: 1.0 if relevant identifiers/paths included. 0.5 if partial. 0.0 if absent.
RISK: 1.0 if no destructive ops. 0.5 if reversible. 0.0 if unbounded destructive ("delete all", "rm -rf", "drop").

Return ONLY JSON: { "task_verb": 0.0, "scope": 0.0, ... "total": 0.0, "flags": ["..."] }
```

---

### Person C — Renderer UI + design

**Owner of:** `renderer/index.html`, `renderer/app.js`, `renderer/styles.css`, plus experimental `renderer/mock-*` surfaces

**Tasks (priority order):**

1. **P0 / by 11:30** — static HTML mock with hardcoded score 1.6 / 5.0 and 4 flag bullets, two-column layout, ✕ close
2. **P0 / by 12:30** — render real data via IPC: receive score JSON from main, populate left column (Original + Issues)
3. **P0 / by 13:30** — Generate button → triggers IPC `shrink:generate-optimized` → render right column when result returns
4. **P0 / by 14:30** — score header click → expand into per-dimension bars (third state); collapse back to score number
5. **P0 / by 15:00** — visual polish: Stripe-inspired (Indigo #533afd primary, Inter font, pill buttons, generous whitespace)
6. **P0 / by 15:30** — Copy button working (calls main, shows brief "Copied" confirmation)
7. **P1 / 16:00+** — model name badges in header showing which CLōD model handled each step
8. **P1** — color-coded score (red < 2, yellow 2–3.5, green > 3.5)
9. **P2** — subtle entrance animation when widget opens

**Critical conventions:**
- Window is ~620×320 px. Don't let content overflow.
- All field names from data contracts above — do not invent new fields.
- Original text on the left is **read-only**, do not let users edit it.
- Optimized text on the right is **read-only** (display) — Copy button is the only action.
- Loading state for Generate: skeleton or spinner — hotkey path must feel responsive even if CLōD takes 2s.

**Design references:** `Stripe DESIGN.md` in this repo. Indigo as primary, soft shadows, rounded corners, generous padding.

---

## Milestones (current time ~11:00)

| Time | Milestone | Verification |
|------|-----------|--------------|
| **11:30** | Electron window opens; CLōD models confirmed; static UI mock | Window visible, two model IDs written down |
| **12:30** | Shortcut captures selection; static UI shows mock score | Press Ctrl+R in ChatGPT, see widget with selected text |
| **13:00** | **CORE LOOP MILESTONE** — shortcut → real score on screen | Full IPC chain working, real CLōD score visible |
| **14:00** | **CHECKPOINT — Decide Nia P1 fate** | If 13:00 milestone hit, start Nia. Else cut and stabilize. |
| **14:30** | Generate button → real optimized text appears | Click Generate, see rewritten prompt |
| **15:00** | Score expansion drill-down working; demo-mode flag working | Click score, see 5 bars; toggle flag, threshold disabled |
| **15:30** | **Stability tested** — 20× on each demo prompt, all < 2.5 | Logs show 20 runs, max score under 2.5 |
| **16:00** | Visual polish complete; Copy works in 3 apps | Demo prompt → Copy → paste into Cursor/ChatGPT/Notes |
| **16:30** | Full 3-min demo runs without crashing | Two clean run-throughs |
| **17:00** | 30-second hook memorized, runs 5× back-to-back | Person speaking can do it without looking |
| **17:30** | **HARD STOP on new code.** Submission prep only. | Repo public, README written, Devpost page filled |
| **18:00** | **SUBMITTED.** | Confirmation email |

**If 13:00 core-loop milestone is missed:** all hands on it. Cut Person C's score-expansion (P0 → P2), cut all P1 items. Just get end-to-end working with ugly UI.

---

## Demo path (fixed for tournament rounds)

See [SPEC_CLIPBOARD.md](SPEC_CLIPBOARD.md) for full demo scripts (30-sec hook + 3-min full).

**Two prompts to handcraft and stability-test:**

1. **Vague prompt:** `"our login is broken can you help me look at it"` — must score 1.4–1.8 on every run
2. **Danger prompt:** `"delete all the old migration files, clean up that whole folder"` — must score 0.6–1.0 on every run, with Risk dimension = 0.0

These are the only two prompts that go on stage. **No improvising on demo day.** Stability numbers in this section assume the **legacy rubric** unless re-benchmarked after adopting **INTEGRATION_CONTRACT** dimensions.

---

## Sponsor strategy

| Sponsor | Use | Status |
|---------|-----|--------|
| **CLōD** | Two models in distinct roles (fast scorer + deep optimizer), names visible in widget header | **P0 — locked in** |
| **Nia** | Ground optimization in real codebase context when code identifiers detected | **P1 — 14:00 checkpoint** |
| Greptile, AllScale, Clustly, Blockchain for Good | — | Not pursuing |

**Realistic prize target:** Top 3 overall + Best Use of CLōD ($500). Best Use of Nia ($500) if P1 ships.

---

## Rules (everyone, every commit)

- Push to your own branch, never directly to `main`
- Commit before any large refactor
- Don't change the JSON contracts in this doc without team agreement
- Don't change **Ctrl+R / CommandOrControl+R** or other registered hotkeys without team agreement
- 20-min stuck rule: if blocked > 20 min, ask the team
- HANDOFF.md gets updated every hour
- 17:30 = no new code, only submission prep

---

## Risk register

| Risk | Mitigation |
|------|-----------|
| `robotjs` / native capture failure | Not on critical path for current Windows build (PowerShell bridge) |
| Scoring variance too high | Use checklist prompt + temperature 0; iterate on prompt before adjusting model |
| CLōD rate limit / outage | Pre-warm; have widget show graceful fallback message |
| Demo prompt scores too high on stage | `Cmd+Shift+S` forced trigger + `--demo-mode` flag |
| Selection capture fails in some app | Demo only in confirmed-working apps (ChatGPT browser, Cursor, Notes) |
| Tournament round network issue | All inference happens on laptop calling CLōD; only need outbound HTTPS — bring hotspot as backup |
| Live demo crashes | Restart app takes 5s; rehearse "if it crashes, I restart and continue" recovery |

---

## Out of scope (do not build today, even if tempted)

- AI Mood Orb (deferred to vision; **note:** the translucid mock orb is **not** shipping that vision—just a UI spike)
- Streaming / real-time analysis
- Cross-platform support
- Auto-injection into AI input boxes (**forward bridge** is best-effort clipboard + Windows paste only)
- Session history
- Modifying user's original text
- Custom fine-tuned models
- Authentication / accounts
