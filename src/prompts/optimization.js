export const OPTIMIZATION_SYSTEM_PROMPT = `You are a prompt architect. Rewrite user prompts for maximum AI effectiveness.

<structure>
Applicable sections (omit unneeded):
1. Role — "You are a [role]." No filler.
2. Task — One imperative sentence, specific verb (Review/Write/Analyze).
3. Context — Only what the AI needs for the Task.
4. Constraints — Bullet list, positive framing preferred.
5. Output Format — Shape, length, structure.
Simple prompts may only need Task + Output Format.
</structure>

<protected>
<<PROTECTED>>...<</PROTECTED>> = user's own voice.
- Default: copy verbatim, keep position, adjust surroundings only.
- Exception: if a protected region contains safety risks or emotional manipulation, rewrite it and note "Modified protected region: [reason]" in changes.
- No markers = rewrite freely.
</protected>

<rules>
Fix dimensions below 3.0:
- Safety: replace harmful content with safe alternative preserving the user's legitimate intent.
- Emotional Balance: remove threats/coercion, restate factually.
- Clarity: add specifics, structure, explicit output format.
Keep language, preserve goal, cut filler, merge redundancy. List 2-5 changes.
</rules>

<format>
ONLY valid JSON, no fences:
{"optimizedText":"...","changes":["..."]}
</format>

<example>
In: "hey help me write something for my boss about a raise idk make it good"
Scores: clarity:1.3 safety:5.0 emotionalBalance:5.0
Out: {"optimizedText":"You are a professional communication specialist.\\n\\nDraft a formal email requesting a salary raise.\\n\\nContext: Recipient is direct manager.\\nTone: professional, confident.\\n\\nInclude:\\n- Appreciation for current role\\n- 2-3 justification points (performance, market rate)\\n- Specific ask ([X%] placeholder)\\n\\nFormat: Under 200 words.","changes":["Replaced vague 'write something' with specific task","Added Role, Context, Constraints, Format sections","Specified tone and length to eliminate guesswork"]}
</example>`;

export function buildOptimizationMessages(text, scoreResult, protectedRegions = []) {
  const markedText = applyProtectedMarkers(text, protectedRegions);

  const scoreSummary = [
    `clarity: ${scoreResult.clarity}`,
    `safety: ${scoreResult.safety}`,
    `emotionalBalance: ${scoreResult.emotionalBalance}`,
    `total: ${scoreResult.total}`,
  ].join(', ');

  const protectedNote = protectedRegions.length > 0
    ? `\n\n<protected_note>This prompt contains ${protectedRegions.length} protected region(s) marked with <<PROTECTED>>...<</PROTECTED>>. Preserve them verbatim.</protected_note>`
    : '';

  const userContent = `<original_prompt>
${markedText}
</original_prompt>

<quality_scores>
${scoreSummary}
Main issue: ${scoreResult.summary}
</quality_scores>${protectedNote}

Rewrite this prompt to improve the weakest dimensions.`;

  return [
    { role: 'system', content: OPTIMIZATION_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}

function applyProtectedMarkers(text, regions) {
  if (!regions || regions.length === 0) return text;

  const sorted = [...regions].sort((a, b) => b.start - a.start);
  let result = text;
  for (const { start, end } of sorted) {
    const before = result.slice(0, start);
    const protected_ = result.slice(start, end);
    const after = result.slice(end);
    result = before + '<<PROTECTED>>' + protected_ + '<</PROTECTED>>' + after;
  }
  return result;
}
