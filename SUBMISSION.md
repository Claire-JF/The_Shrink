# Devpost Submission Form — Archive & Draft

> **Submission URL:** https://devpost.com/submit-to/29854-cursor-hackathon-vancouver/manage/submissions/1015516/manage-team
> **Hard cutoff:** 6:00 PM, Sunday May 10, 2026 — no exceptions
> **Format:** This file archives every field on the Devpost form verbatim, and provides space below each one for our drafted answer. Fill in the `Our draft:` blocks, then copy-paste into Devpost at submission time.

---

## 1. Project overview

> Please respect our Community Guidelines.

### 1.1 Project name

> *You can change this at any time.*
> *(60 characters left)*

**Our draft:**

```
The Shrink
```

(10 / 60 characters)

---

### 1.2 Elevator pitch

> *Provide a short tagline for the project. You can change this later.*
> *(200 characters left)*

**Our draft:**

```
The missing keyboard layer for the agent era. Select any text, hit ⌘⌥T,
and a hover window translates your human intent into a spec the agent
can actually execute.
```

(_check char count before pasting_)

**Alternative shorter:**

```
Select any text, hit ⌘⌥T — The Shrink rewrites your prompt into
something an agent can actually execute. The missing keyboard layer
for the agent era.
```

---

## 2. Project details

> *For public project page. Information entered below will appear on your public project page.*

---

### 2.1 Project Story — About the project

> *Be sure to write what inspired you, what you learned, how you built your project, and the challenges you faced. Format your story in Markdown, with LaTeX support for math.*
>
> *Default placeholder:* `## Inspiration...`
>
> **Markdown tips:**
> - `## Headline`
> - `**bold**`
> - `_italics_`
> - `[link](http://foo.bar)`
> - `![Alt text](/path/to/img.jpg)`
> - Code block: triple-backtick + language
>
> **LaTeX:**
> - `\\( ... \\)` for inline math
> - `$$ ... $$` for displayed equations

**Our draft:**

```markdown
## Inspiration

Every failed agent conversation starts with something humans didn't quite
say right.

We've all been there: you ask Cursor / Claude / ChatGPT for help, the
answer is generic or wrong, and you blame the model. But more often than
not, the prompt was vague — no scope, no done condition, no success
criteria. The agent had nothing executable to work with.

We didn't want to build another prompt assistant for humans. We wanted
to build infrastructure for agents — the layer that sits between every
keyboard and every agent and silently translates intent into spec.

## What it does

The Shrink is a macOS hover window. Select any text in any app, press
⌘⌥T, and you get:

1. **A score (0–5.0) on 5 dimensions** — Task Verb, Scope, Success
   Criteria, Context, Risk — fast pass via CLōD.
2. **A list of what's missing or risky.**
3. **A click to generate** — a deeper CLōD model rewrites the input
   into an agent-ready version (real file paths, scoped boundaries,
   done conditions, safety guards).
4. **A click to copy** — paste anywhere, into any AI tool.

Your original text is never modified. The Shrink is the missing
keyboard layer for the agent era — same hotkey works in Cursor, in
ChatGPT, in Claude desktop, in Notes, in Slack, anywhere a human types
text destined for a model.

## How we built it

- **Desktop shell:** Electron, frameless always-on-top hover window.
- **Hotkey:** Electron `globalShortcut.register('CommandOrControl+Option+T')`.
- **Selection capture:** simulate ⌘C via AppleScript (`osascript`),
  read clipboard, restore previous clipboard contents.
- **Scoring + optimization:** **CLōD** API — two models in two
  clearly-different roles. A fast model scores the 5 dimensions; a
  deeper model rewrites. Both model names are visible in the widget
  header, satisfying the CLōD rubric requirement for visible model
  selection.
- **Codebase grounding:** **Nia** — when the selected text contains
  code identifiers (file paths, function names), we call Nia
  `lookup_codebase_context` and inject the result into the optimization
  prompt. This is the difference between "rewriting" and "grounding."
  Nia's own positioning ("drop in a Nia search and your agent stops
  hallucinating file paths") is verbatim what The Shrink does on every
  ⌘⌥T.
- **No backend.** Electron main process calls CLōD and Nia directly.

## Challenges we ran into

- **Hotkey collisions.** ⌘T conflicts with new-tab in browsers and
  every IDE. We landed on ⌘⌥T as the default, with the hotkey
  user-configurable.
- **Selection capture without modifying the user's clipboard.** The
  ⌘C-and-restore dance is timing-sensitive; we built explicit
  read-write-restore guarding.
- **LLM scoring stability.** A 5-dimension scoring prompt has to
  return the same number for the same input every time. We pinned
  `temperature: 0`, baked per-dimension checklists into the prompt,
  and stress-tested every demo prompt 20× to confirm stable thresholds.
- **The safety case.** For our "delete all migration files" demo to
  work, the optimizer had to convert destructive operations into
  dry-run-plus-confirmation patterns — not just rephrase them. We
  encoded this as an explicit rule in the optimizer system prompt.

## Accomplishments we're proud of

- A hover window that works across every macOS app — not a Chrome
  extension, not an IDE plugin. The keyboard layer.
- The Before / After comparison lives entirely inside our own widget,
  so the demo never depends on a third-party AI tool cooperating live.
- The product UI uses Cursor's own design language — warm cream
  canvas, ink typography at weight 400, hairline-only depth, and the
  five timeline pastels (peach / mint / pastel-blue / lavender / gold)
  mapped 1:1 to our five scoring dimensions.

## What we learned

- The interesting question wasn't "how do we make a better prompt
  rewriter." It was "what's the right surface for prompt help to live
  on." Once we picked clipboard-on-hotkey instead of a chat sidebar
  or an IDE plugin, the rest of the design fell into place.
- Two different LLMs in two different roles is genuinely better than
  one LLM doing both. The fast model scores cheaply; the deeper model
  only runs when the user commits to a generation.
- LLM scoring is unstable unless the prompt forces a checklist
  format. Free-form judgment varies wildly between runs.

## What's next for The Shrink

- **AI Mood Orb** — an ambient companion that watches ongoing AI
  conversations and shows the agent's "mood" (confused, threatened,
  overwhelmed, ready). Two-direction therapist: input + reaction.
- **Per-agent profiles** — different optimization rules for Cursor vs
  ChatGPT vs Claude vs terminal, since each agent has different
  preferences for how much context to include.
- **Team conventions layer** — ingest a team's CONTRIBUTING.md and
  bake the conventions into every optimization.
- **Cross-platform** — Windows and Linux ports.
- **The Shrink as background daemon** — opt-in mode that scores every
  copy automatically and only surfaces when score is below threshold,
  for users who want the layer to be ambient.
```

---

### 2.2 Built with

> *What languages, frameworks, platforms, cloud services, databases, APIs, or other technologies did you use?*
>
> *Languages, frameworks, platforms, cloud services, databases, APIs, etc.*

**Our draft (tag list — Devpost takes these as comma-separated tags):**

```
electron
javascript
node.js
applescript
macos
clod
nia
html
css
jetbrains-mono
```

(_Confirm exact CLōD / Nia tag spellings on the Devpost tag selector — Devpost auto-completes from a known tag list._)

---

### 2.3 "Try it out" links

> *Add links where people can try your project or see your code.*
> *URL for demo site, app store listing, GitHub repo, etc.*

**Our draft:**

```
https://github.com/Claire-JF/The_Shrink
```

(Add release / download link if we ship a packaged `.dmg` or `.zip`
of the Electron build by 18:00. Otherwise GitHub repo only.)

---

## 3. Project Media

### 3.1 Image gallery

> *JPG, PNG or GIF format, 5 MB max file size. For best results, use a 3:2 ratio.*

**Plan:**

| # | What to upload | Source |
|---|----------------|--------|
| 1 | Hero shot — The Shrink State 2 widget (Before / After dual-column with all 5 pastel pills filled) | Figma export from `pitch/` deck |
| 2 | Slide 2 — Before / After ChatGPT screenshots showing same intent / different prompt / different outcome | Real screenshot, ChatGPT logo cropped |
| 3 | Slide 4 — Architecture diagram (CLōD fast → CLōD deep → Nia grounding) | Figma export |
| 4 | The danger scenario — `"delete all migration files"` → dry-run + confirmation rewrite | Real product screenshot |
| 5 | The Shrink in context — widget hovering over Cursor / over Notes / over ChatGPT browser tab (composite) | Composite from real screenshots |

All exported at 3:2 ratio (1500×1000 recommended). All ≤5 MB.

---

### 3.2 Video demo link

> *This video will be embedded at the top of your project page. Read more about uploading videos.*

**Plan:** YouTube unlisted link to the 3-minute demo recording.

Recording window: **17:30–17:45**, after final dry runs.

Tooling: QuickTime screen record + voiceover, exported H.264, uploaded
unlisted to YouTube. Devpost prefers YouTube / Vimeo embeds over direct
upload.

**URL placeholder:**

```
[ YouTube unlisted link — fill in by 17:50 ]
```

---

## 4. Additional info

> *For judges and organizers. Unless noted, additional info is for judges and hackathon organizers and will not appear on your public project page.*

---

### 4.1 Sponsor / Special Prizes

> *(Devpost form section — checkboxes / form fields for which sponsor tracks we are submitting for. Exact field labels TBD on the form.)*

**Our submissions:**

| Sponsor track | Submitting? | Why |
|---|---|---|
| **Best Use of CLōD ($500 CAD)** | ✅ YES | Two models in clearly-different roles (fast scorer + deep optimizer), real API calls from our CLōD account, model selection visible in widget header. |
| **Best Use of Nia ($500 CAD)** | ✅ YES (if shipped) | Nia `lookup_codebase_context` grounds optimization in real codebase context when code identifiers are detected. Nia's own marketing "drop in a Nia search and your agent stops hallucinating file paths" is verbatim what The Shrink does. |
| Best Use of Greptile ($600 CAD) | ❌ no | Not used in MVP. |
| Best Use of AllScale ($300 CAD) | ❌ no | Not applicable. |
| Best Chain for Good Project (300 USDT) | ❌ no | Not applicable. |
| Best Use of Clustly (300 USDT) | ❌ no | Not applicable. |

(_Decision rule: only check Nia box if Nia integration is actually merged
and demo'd by 17:00. Do not claim a sponsor we did not actually use._)

---

## 5. Submission day checklist

Use this in the final hour to make sure nothing is missed.

- [ ] Project name entered (≤60 chars)
- [ ] Elevator pitch entered (≤200 chars)
- [ ] About-the-project markdown pasted
- [ ] Built-with tags selected (CLōD, Nia, Electron, etc.)
- [ ] GitHub repo URL added under "Try it out"
- [ ] 5 images uploaded (≤5 MB each, 3:2 ratio)
- [ ] Video demo URL pasted (YouTube unlisted)
- [ ] CLōD sponsor track box checked
- [ ] Nia sponsor track box checked (only if shipped)
- [ ] Team members all added to Devpost submission
- [ ] Final preview reviewed for typos
- [ ] Submitted before 18:00 (hard cutoff, no exceptions)

---

## 6. Notes for the team

- **Char limits matter.** Devpost truncates silently at 60 / 200 char
  limits. Count before pasting.
- **Tags auto-complete.** When typing in "Built with", let Devpost's
  autocomplete pick the canonical spelling for `clod`, `nia`, etc.
- **You can edit after submitting.** The form allows edits up until
  the cutoff, so submit a half-filled version by 17:30 to lock the
  slot, then refine.
- **Image gallery order = display order.** Put the strongest hero shot
  first; that's what shows on the project card.
- **Video URL must be embeddable.** YouTube unlisted is safest. Vimeo
  works. Direct file upload to Devpost is slow and lossy — avoid.
- **Verbatim form fields above are from the Devpost form as captured
  on May 10, 2026 at the submission URL. If Devpost changes the form,
  re-archive and update this file.**
