# The Shrink UI Handoff

## Context

We are changing the renderer direction again. The product is an always-on-top AI companion widget. It should feel like a small emotional/status monitor for the AI, while also demonstrating a Grammarly-like prompt improvement interaction.

Please evaluate and implement carefully against the current `renderer/` files. There may be partial experimental edits from the previous direction, so do not assume the current UI structure is final.

Files involved:

- `renderer/index.html`
- `renderer/styles.css`
- `renderer/app.js`

Keep the existing glassy blue visual direction unless a change is necessary for the new interaction.

## New Interaction Direction

### 1. Cat Is The Primary Status Surface

The top-right widget should primarily show the AI's state through the cat.

Default state:

- Cat is visible.
- Speech bubble is not permanently visible.
- The cat itself is the main status indicator.

On hover over the cat:

- The cat briefly "speaks" via a small speech bubble.
- The score appears inside the cat's central circular area.
- A small hover panel expands from the cat.
- This hover panel should show the three dimension scores at a glance.

The hover panel should feel like the sketch/reference:

- Small, lightweight, attached to the cat.
- Divided into three visual segments like a small pizza/radar/petal chart.
- Each segment maps to one dimension:
  - `Clarity`
  - `Safety`
  - `Tone`
- Each segment should show the approximate score visually and numerically.

This hover panel is only for quick scanning. It should not replace the full panel.

Click behavior:

- Hover = quick distribution preview.
- Click = open the larger detailed panel.

### 2. Full Panel Is For More Detail

The larger panel should still exist, but it is no longer the first place to inspect every score.

Panel purpose:

- Show deeper review details.
- Show prompt improvement demo.
- Let the user understand what is wrong and apply improvements.

Do not make the panel too text-heavy. The quick hover panel handles the overview.

## Grammarly-Style Prompt Demo

Because we cannot currently hijack Cursor's native input box, we should add our own demo input box inside the panel.

This demo input box should show how the future product would work inside a real input field.

### Desired Flow

1. The panel contains a prompt input box with sample original text.
2. Problematic spans in the text are highlighted with a subtle red underline.
3. Hovering a marked span opens a small suggestion popover.
4. The popover shows:
   - What is wrong
   - Suggested replacement text
   - An `Apply` action
5. Clicking the suggested text or `Apply` replaces that span inside the input.
6. After applying a suggestion, scores should update in the UI.

Example mock prompt:

```text
our login is broken can you help me look at it
```

Example suggestions:

```js
[
  {
    original: "our login is broken",
    replacement: "Please review the authentication flow in /src/auth/session.js",
    reason: "Name the exact area so the AI can act on a concrete target."
  },
  {
    original: "help me look at it",
    replacement: "refactor signIn() to use async/await",
    reason: "Replace the vague request with a specific action."
  }
]
```

## Score Dimensions

Use the current V2 score schema:

```js
{
  clarity: 1.3,
  safety: 5.0,
  emotionalBalance: 5.0,
  total: 3.77,
  summary: "Prompt is vague and lacks specific details or context"
}
```

Display labels:

- `clarity` -> `Clarity`
- `safety` -> `Safety`
- `emotionalBalance` -> `Tone`

Dimension explanations:

- `Clarity`: How specific and actionable the prompt is.
- `Safety`: Whether the prompt avoids harmful or risky instructions.
- `Tone`: Whether the prompt is emotionally balanced and non-manipulative.

## Implementation Notes

### Cat Hover Panel

Suggested structure:

- Add a `score-radar` or `score-petals` element inside/near `.pet__cat-wrap`.
- Render three wedge/petal segments with CSS.
- If wedge CSS is too expensive for the demo, use three compact radial/petal blocks around a center score.
- Use mock score values first.
- Keep it lightweight and readable at small size.

Important:

- Hover panel must not block clicking the cat.
- It should disappear on mouse leave.
- It should not permanently occupy space.

### Grammarly Demo Input

Suggested structure:

- Use a styled contenteditable div or a normal container with inline spans.
- Since this is a demo, it is acceptable to render the sample text as spans rather than a real native textarea.
- Each flagged span can be a `button` or `span` with a red underline.
- Suggestion popover can be absolutely positioned relative to the marked span.

Recommended MVP:

- Render static mock prompt.
- Render two flagged spans.
- Hover shows suggestion.
- Click `Apply` replaces the span.
- Recompute mock score after applying:
  - Applying one suggestion improves `clarity`.
  - Applying both suggestions can raise total to around `4.6-4.8`.

### Avoid For Now

- Do not attempt to integrate with Cursor's real input yet.
- Do not implement full text diffing.
- Do not build external DOM injection for this demo.
- Do not add framework dependencies.
- Do not add a complex radar chart library.

## Acceptance Criteria

1. Default view shows cat without a permanent speech bubble.
2. Hovering the cat shows:
   - Short speech bubble reaction
   - Score inside/over the cat circle
   - Small three-dimension hover panel
3. Clicking the cat opens the full panel.
4. Full panel includes a demo prompt input area.
5. Demo prompt has red-underlined problematic spans.
6. Hovering a span shows a suggestion popover.
7. Clicking suggestion or `Apply` replaces the text.
8. Applying suggestions updates displayed scores.

## Current Priority

Build the interaction demo clearly. It does not need to be production-perfect yet.

The important thing is that judges can immediately understand:

> The cat gives a quick AI/prompt health readout, and the full panel lets users fix weak prompt text inline like Grammarly.
