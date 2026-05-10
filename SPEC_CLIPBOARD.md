# The Shrink — Spec (Hotkey Edition, Final)

> **Maintainers:** Product narrative lives here; **implementable truth** lives in **[AGENT_CONTEXT.md](AGENT_CONTEXT.md)**. Hotkey for the shrink widget on current builds is **Ctrl+R** (`CommandOrControl+R`), not Cmd+T. Implemented scoring fields follow **[INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md)** (five 0–5 dimensions + `summary`), which **differs** from the dimension table (`Task Verb`, `Scope`, …) still described below as the original UX storyboard. **Protected spans** before Generate and **`optimize(..., { protectedRegions })`** are documented in **AGENT_CONTEXT** + **`temp/PROTECTED_REGIONS_SPEC.md`**. On Windows, selection capture prefers **UI Automation** over simulating copy; see **AGENT_CONTEXT**.

## What it is

**The missing keyboard layer for the agent era.**

Every time you copy something, the next thing you do is paste it into an agent — Cursor, ChatGPT, Claude, a terminal, an IDE plugin. The Shrink intercepts that moment: select your text, hit the **global shortcut** (**Ctrl+R** on Windows), and a hover window translates your human intent into a spec the agent can actually execute.

We're not a prompt assistant for users. We're an input layer that sits between every keyboard and every agent — the layer that lets agents stop guessing what humans meant.

**One-liner:**
> The Shrink is the missing keyboard layer for the agent era. Every failed agent conversation starts with something humans didn't quite say right.

**Theme alignment ("Build something agents want"):**
Agents don't fail because they're dumb. They fail because they receive prompts they can't execute — vague verbs, no scope, no done condition, hallucination-inviting gaps. The Shrink is the input layer agents have been silently asking for, working across every AI tool you use.

---

## Core workflow

```
User selects text in any app (any AI tool, any editor)
  → Presses Ctrl+R / CommandOrControl+R (global shortcut — team-aligned)
  → Main process simulates Cmd+C, reads selection, restores original clipboard
  → Hover window appears near cursor
  → Left side: issues + score
  → User clicks "Generate" on right side
  → Optimized version appears on the right
  → User clicks "Copy" — optimized version is in clipboard
  → User pastes wherever they want — original text is never modified
```

**Critical:** The Shrink never modifies the user's original text. It only writes to clipboard on explicit Copy click. Original clipboard contents are restored after selection capture.

---

## Input scoring — 5 dimensions (UX storyboard — see INTEGRATION_CONTRACT for code)

*Narratively* each semantic dimension reads like 0–1 in this section. **Actually shipped JSON** keeps five numeric dimensions at **0.0–5.0**, `total` = mean, plus `summary` — see **[INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md)**.

| Dimension | What it checks |
|-----------|----------------|
| **Task Verb** | Clear, executable action verb? |
| **Scope** | Defined boundary (which files / module / what NOT to touch)? |
| **Success Criteria** | Does the agent know when it's done? |
| **Context** | Relevant names, paths, constraints included? |
| **Risk** | Destructive or unbounded operations? (high risk = low score) |

---

## UI — two states, side-by-side, self-contained

**The Before/After lives entirely inside our window.** We do not rely on the user's AI tool to demonstrate value. The widget itself proves the transformation.

**State 1 — On global shortcut activation (immediate, fast model only):**

```
┌──────────────────────────────────────────────────────┐
│  Score   1.6 / 5.0      [click to expand]      ✕    │
│  ──────────────────────────────────────────          │
│                                                      │
│   Original                │   Issues                 │
│   ─────                   │   ─────                  │
│   "our login is broken    │   ⚠ Vague verb           │
│   can you help me look    │   ⚠ No scope             │
│   at it"                  │   ⚠ No done condition    │
│                           │   ⚠ Missing context      │
│                           │                          │
│                           │   ⌄ Tap to generate fix  │
│                           │                          │
└──────────────────────────────────────────────────────┘
```

**State 2 — After Generate (deep model called):**

```
┌──────────────────────────────────────────────────────┐
│  Score   1.6  →  4.7    [click to expand]      ✕    │
│  ──────────────────────────────────────────          │
│                                                      │
│   Original                │   Optimized              │
│   ─────                   │   ─────                  │
│   "our login is broken    │   Refactor signIn() in   │
│   can you help me look    │   /src/auth/session.js   │
│   at it"                  │   to use async/await.    │
│                           │   Do not change the      │
│   Issues fixed:           │   public API. Done when  │
│   ✓ verb defined          │   all existing tests     │
│   ✓ scope set             │   pass.                  │
│   ✓ done condition        │                          │
│   ✓ context grounded      │              [ Copy ]    │
└──────────────────────────────────────────────────────┘
```

**Score click → expanded radar (third state, optional drill-down):**

```
   Task Verb    ████░░░░░░  0.4 → ██████████  1.0
   Scope        ░░░░░░░░░░  0.0 → █████████░  0.9
   Success      ░░░░░░░░░░  0.0 → ██████████  1.0
   Context      █████░░░░░  0.5 → ████████░░  0.8
   Risk         ██████████  1.0 → ██████████  1.0
```

**UI rules:**
- Window appears near cursor, draggable, always-on-top
- Closes only via ✕ or Esc (no auto-dismiss on focus loss)
- Original user text never modified
- Two-step (issues → generate) intentional: lets users read problems before seeing fix; controls demo pacing
- Header shows which CLōD model handled which step (CLōD rubric requires visible model selection)

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Desktop shell | Electron (hover widget + optional standalone mock shells) |
| Hotkey | `globalShortcut` — **Primary:** `CommandOrControl+R`; aux: Ctrl+Shift+W (mock shells), Ctrl+Shift+S/D |
| Selection capture | **Windows:** Electron clipboard ↔ PowerShell `[SendKeys]::SendWait('^c')` (**no robotjs**) |
| Scoring + optimization | CLōD API — two models, called sequentially |
| Model 1 (fast) | Score dimensions on Ctrl+R shortcut (immediate display where applicable) |
| Model 2 (deep) | Rewrite into optimized form (only when user clicks Generate) |
| IPC | Electron ipcMain / ipcRenderer |
| UI | Plain HTML/CSS/JS — no build step |

**No backend server.** Main process calls CLōD directly.

**Sequential not parallel:** score first (cheap, fast). Optimizer only runs on Generate click. Saves tokens on dismissed prompts.

---

## CLōD call pattern

```javascript
// On Ctrl+R (CommandOrControl+R)
const scoreResult = await callCLOD(FAST_MODEL, scoringPrompt(selectedText), {
  temperature: 0  // CRITICAL for demo stability
});
showState1(scoreResult);

// On Generate click
const optimizedResult = await callCLOD(DEEP_MODEL, optimizationPrompt(selectedText, scoreResult), {
  temperature: 0.2
});
showState2(optimizedResult);
```

**Scoring prompt output:**
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
    "Unbounded operation: 'delete all'"
  ]
}
```

**Optimization prompt output:** plain text — the rewritten, agent-ready version. Optionally includes a `fixed: [...]` array of which dimensions were addressed.

**Stability requirements (non-negotiable):**
- `temperature: 0` on the scoring call
- Scoring prompt must include explicit per-dimension checklists, not free-form judgment
- Demo prompts must be tested 20× each, all 20 must score < 2.5 to guarantee the gap
- Any CLōD failure → show "Analysis unavailable" in widget, never crash

---

## Demo mode

**Production behavior:** widget only expands when score < 3.0 (don't interrupt good prompts).

**Demo mode (`--demo-mode` flag or `Cmd+Shift+D` toggle):** widget always expands. Used for judging so a borderline-score prompt doesn't silently fail to trigger.

**Forced trigger:** `Cmd+Shift+S` always opens the widget for the current selection regardless of score. Hidden hotkey, used as last-resort fallback if score classification misbehaves on stage.

---

## P1 — Nia integration (14:00 checkpoint)

**Trigger:** if MVP loop is solid by 14:00, add Nia. If not, skip.

**Detection:** if selected text contains a file path (`/...`) or code-style identifier (`camelCase`, `snake_case`, `function foo()`), trigger Nia lookup before optimization.

**Flow:**
```
selectedText contains code identifier
  → fetch Nia: lookup_codebase_context(query: identifier)
  → inject Nia result into optimization prompt:
     "Project context: {nia_result}"
  → optimizer rewrites with grounded references (real file paths, real conventions)
```

**Why this matters:** without Nia, optimization is rewriting. With Nia, optimization is grounding. This is the difference between "prompt tool" and "agent infrastructure" — and Nia's own positioning is literally "drop in a Nia search and your agent stops hallucinating file paths," which is verbatim our pitch.

**Implementation cost:** ~30–45 min. One conditional, one fetch, one string injection.

**Demo upgrade:** show "without Nia → made-up path" vs "with Nia → real path from indexed repo." Highly persuasive.

---

## File structure

**Obsolete flat tree below.** Current repo bundles plumbing under **`backend1/`**, LLM logic under **`src/`**, auxiliary mock UI under **`renderer/mock-*`** — details in **[AGENT_CONTEXT.md](AGENT_CONTEXT.md)**.

```
legacy-map/ (mental model only)
  main.js              ← now root main.js (+ backend1/bootstrap)
  selection.js         ← now backend1/selection.js (+ Windows PS path)
  clod.js scorer.js... ← now consolidated src/index.js + src/llm/*
  renderer/
    index.html         ← two-state widget UI shell
    app.js             ← state transitions, render, Copy action, score expand
    styles.css         ← floating widget styles, side-by-side layout
  .env                 ← CLOD_API_KEY, NIA_API_KEY (never commit)
  .env.example
```

---

## Demo scripts — TWO versions required (tournament format)

### 30-second hook (for elimination rounds 8 → 4 → 2 → 1)

Memorize verbatim. Run 5× before the event. No room for improvisation.

> 1. *(point at screen)* "Watch the clipboard."
> 2. *(select messy prompt in any text field, press **Ctrl+R** — Windows shortcut)* "I selected my prompt. I hit our global shortcut."
> 3. *(widget appears, score 1.6)* "It tells me what's wrong — vague verb, no scope, no done condition."
> 4. *(click Generate)* "I tap once."
> 5. *(optimized appears, score 4.7)* "It rewrote it as something an agent can actually execute."
> 6. *(click Copy)* "Now my clipboard is the agent-ready version. Paste anywhere."
> 7. *(closing line)* "This is the missing layer between Cmd+C and every AI tool you use."

### 3-minute full demo (for submission video + opening round)

**Beat 1 (30s) — Hook**
> "Every failed agent conversation starts with something humans didn't quite say right. The Shrink is the missing keyboard layer for the agent era."

**Beat 2 (45s) — The base demo**
- Select messy prompt: `"our login is broken can you help me look at it"`
- Ctrl+R → widget shows score 1.6, four issues
- Click Generate → optimized version appears with file path, scope, done condition
- *"Same intent, but now the agent has something it can execute."*

**Beat 3 (45s) — The danger scenario (Impact moment)**
- Select: `"delete all the old migration files, clean up that whole folder"`
- Ctrl+R → Score 0.8, Risk flagged (dimension narrative; see Integration Contract for coded rubric)
- Optimized: `"List migration files older than 2024-01 in /migrations. Output the list and wait for confirmation. Do not delete."`
- **Key line:** *"This isn't productivity. This is safety infrastructure for agents."*

**Beat 4 (30s) — Universal applicability**
- Same hotkey in Cursor → in Notes → in Slack
- *"It's not a Chrome extension. Not a ChatGPT plugin. It's the input layer for every AI tool you use."*

**Beat 5 (30s) — Closing**
> "Every AI agent reads prompts written by humans who don't know how agents think.
> Agent failure isn't the agent's fault — it's the missing translation layer.
> The Shrink is that layer.
> If this lived in front of every agent, agents wouldn't get smarter. They'd just stop failing for stupid reasons."

---

## Future Vision (mention in pitch, do not build today)

- **AI Mood Orb (ambient observer):** small persistent widget that watches ongoing AI conversations via macOS Accessibility API and shows the agent's "mood" — confused, threatened, overwhelmed, ready. Two-direction therapist: input + reaction.
- **Nia memory deep integration:** auto-detect project, persistent context grounding across all prompts.
- **Per-agent profiles:** different optimization rules for Cursor vs ChatGPT vs Claude.
- **Team conventions layer:** ingest a team's CONTRIBUTING.md and bake it into every optimization.

These are not P0/P1. They're the roadmap slide. Mention in pitch as "what comes next."

---

## Sponsor strategy

| Sponsor | Use | Priority |
|---------|-----|----------|
| **CLōD** | Two models in clear roles: fast scorer + deep optimizer. Model name visible in widget header. | P0 — required |
| **Nia** | Ground optimization in real codebase context when code identifiers detected. | P1 — 14:00 checkpoint |
| Greptile | — | Skip |
| AllScale / Clustly / Blockchain for Good | — | Not applicable |

---

## Out of scope (do not build today)

- AI Mood Orb (deferred to vision)
- Real-time typing analysis
- Auto-injection into AI app input boxes
- Cross-platform (macOS only)
- Learning from user corrections
- Session history
- Modifying the user's original text

---

## Demo prep checklist

**Before 17:00:**
- [ ] Two demo prompts handcrafted, scored 20× each, all under 2.5
- [ ] CLōD warm-up call before judging (avoid first-call cold latency)
- [ ] Two CLōD model IDs confirmed from clod.io/models
- [ ] Both models display in widget header
- [ ] Ctrl+R tested working in: ChatGPT browser, Cursor, Notes, Slack

---

## Auxiliary mock surfaces (`Ctrl+Shift+W`)

The repo also ships a **bottom input strip + orb** for iterative typing UX: live heuristic + debounced **`shrink:score-live`**, **Send → `shrink:forward-prompt` + `shrink:chat-send`**. Detailed wiring: **[AGENT_CONTEXT.md](AGENT_CONTEXT.md)**.
- [ ] Esc/✕ close confirmed working
- [ ] Original clipboard correctly restored after selection capture
- [ ] `--demo-mode` flag tested
- [ ] `Cmd+Shift+S` forced trigger confirmed working
- [ ] 30-second hook memorized verbatim, run 5× back-to-back without breaking
- [ ] 3-minute full demo run twice without crashing
