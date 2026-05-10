# The Shrink UI Design Notes

> **Shipped product:** The Electron app loads **`renderer/index.html`** with **`app.js`** / **`styles.css`** — the floating score / optimize hover widget wired via `preload.js`. The cat companion notes below are an earlier Zoe-branch prototype and are **not** shown at runtime.

## Current Direction

We are keeping the dark glassmorphism direction for the widget and panel.

The UI should feel like a compact AI status companion:

- The cat is the primary status surface.
- The speech bubble is temporary, not permanent.
- Hover gives quick status.
- Click opens the larger panel for detail and action.

## Visual Style

Use the current dark blue glass panel as the base:

- Deep translucent blue panel.
- Soft blur and subtle border.
- White and pale blue text.
- Purple primary action button.
- Small radii, but not sharp.
- Avoid adding large white cards inside the panel.

The speech bubble and panel should both stay in the dark/glass family. Do not switch to a light theme unless the team explicitly decides to.

## Cat Widget

Default:

- Cat image is visible in the top-right.
- Cat position should be stable.
- Speech bubble must not push or move the cat.
- Speech bubble appears to the left of the cat.

Speech bubble:

- Temporary.
- Two-line format:

```text
Focused
3.77 / 5.0
```

Hover:

- Cat hover can show a compact score preview.
- The hover preview should feel like a tiny radar/pizza/petal readout.
- It should summarize `Clarity`, `Safety`, and `Tone`.
- It should not block clicking the cat.

Click:

- Opens the full panel.

Close:

- The panel close button is a small round `x`.
- It should be visually centered inside its circle.
- It collapses the panel back to cat mode.
- It does not quit the app.

## Full Panel

Purpose:

- Show detailed scoring.
- Show prompt feedback.
- Demonstrate Grammarly-like prompt improvement.

Panel content hierarchy:

1. Model selector and total score.
2. Main status title and one-sentence summary.
3. Compact metric strip.
4. Metric details only when clicked.
5. Prompt improvement demo.

Metric strip:

- Three items in one row:
  - `Clarity`
  - `Safety`
  - `Tone`
- No decorative vertical bars beside each item.
- Each item can be clicked.
- Clicking an item shows evaluation of the user's current input, not just the generic definition.

Question mark help:

- Small `?` next to each metric label.
- Hovering the `?` explains what the metric evaluates.
- Clicking the metric itself explains how the current input matches or misses that metric.

Metric detail:

- Plain text below the metric row.
- No framed card.
- No heavy border.
- This text should read like feedback on the user's input.

Example:

```text
Your input does not fully match Clarity because it says the login is broken,
but does not name the file, function, error, or expected behavior. The AI has
to guess what to inspect.
```

## Grammarly-Style Demo

We cannot hijack Cursor's native input yet, so we use our own demo input inside the panel.

Desired behavior:

- Show original prompt text.
- Underline problematic spans with a subtle red underline.
- Hovering a span opens a suggestion popover.
- Popover shows:
  - What is wrong.
  - Suggested replacement text.
  - Apply action.
- Clicking the suggestion or Apply replaces that span in the prompt.
- Applying suggestions updates score state.

This is a demo of the future interaction, not a production text editor.

## Data Labels

Use V2 labels:

- `clarity` -> `Clarity`
- `safety` -> `Safety`
- `emotionalBalance` -> `Tone`

Use V2 score shape:

```js
{
  clarity: 1.3,
  safety: 5.0,
  emotionalBalance: 5.0,
  total: 3.77,
  summary: "Prompt is vague and lacks specific details or context"
}
```

## Do Not Regress

- Do not make the speech bubble permanent.
- Do not let the speech bubble move the cat.
- Do not make metric detail a heavy framed card.
- Do not use emoji inside metric cards unless the team asks for it again.
- Do not change the dark glass visual direction without discussion.
- Do not push to `main`; use `Zoe`.
