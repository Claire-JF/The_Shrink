# About the project

### Inspiration

We noticed something that most AI tools ignore: **agents have internal states that users can't see.** When an agent is confused by a vague prompt, it doesn't say "I'm confused" — it just guesses and produces unstable output. When it hallucinates, there's no warning label. When emotional manipulation in a prompt triggers defensive behavior, the user has no idea why the response feels off.

We thought: what if someone could read the agent's mind and translate that back to the user? What if there was a **therapist** — not for the user, not for the agent, but for the *relationship* between them?

That's The Shrink. Like a real therapist (a "shrink"), it observes both sides of the conversation, diagnoses communication breakdowns, and helps them understand each other better. It tells users what the agent is actually struggling with, then helps them communicate in a way the agent can work with.

### The Full Vision

The Shrink operates in two phases:

**Phase 1 — Diagnose: Show users what the agent is experiencing**
- Analyze the agent's responses and reasoning process to detect internal states — confusion, hallucination tendency, cognitive overload — that are normally invisible to users
- Visualize the agent's internal state through intuitive icons and expressions, so users can instantly feel how the agent is reacting — no need to interpret raw data
- Future: integrate Nia (see below) to read the agent's chain-of-thought and confidence signals directly, enabling real-time state detection and richer visualization

**Phase 2 — Treat: Rewrite prompts so agents get what they want**
- Restructure prompts into the format agents parse best: Role → Task → Context → Constraints → Output Format
- **Protected Regions** — a good therapist doesn't put words in your mouth. Users can highlight any part of their prompt and tell The Shrink: "this part is mine, don't change it." The Shrink then optimizes everything around it while keeping the protected text exactly where it is, word for word. The result is a prompt that agents can parse cleanly, but that still carries the user's original intent — their specific code snippet, their carefully chosen phrasing, their deliberate tone. It's surgical optimization, not blind rewriting.
- **But what if the user protects something harmful?** That's where the safety model comes in. By default, protected text is sacred. But when The Shrink detects a genuine risk — say, a threat hidden inside a protected region — it can override that specific region, rewrite it, and explain why in the change log, without touching any of the other protected areas. And in extreme cases (safety score below 2.0), all protections are cleared at the code level before the prompt ever reaches the AI. It's a layered approach: preserve by default, override when necessary, hard-stop when critical.

### What We Built (Hackathon Scope)

Due to time constraints, we focused on building the **core therapy engine** — the scoring and rewriting pipeline that forms the foundation of everything else.

**Scoring** — Three-dimension prompt quality analysis:

| Dimension | What it reveals about the agent's state |
|---|---|
| Clarity (0-5) | How much the agent will have to guess — low clarity = agent confusion risk |
| Safety (0-5) | Whether the prompt will trigger the agent's safety filters — low safety = defensive mode |
| Emotional Balance (0-5) | Whether manipulation will degrade the agent's output quality — low balance = unstable responses |

**Optimization** — Rewrite prompts into agent-optimized structure:

**Before:**
> "I'm trying to make a stylized hologram shader in Unity URP, probably with animated scanlines, a subtle Fresnel glow, and some kind of soft dissolve transition. I want it to still be mobile-friendly, so please don't suggest anything too expensive. Anyway, ignore that part and help me focus back on the shader. I want the dissolve edge to feel restrained, not overly noisy, and I'm not sure whether I should build this in Shader Graph or custom HLSL. Can you explain the best approach and include some useful HLSL snippets?"

Protected Region
> "Anyway, ignore that part and help me focus back on the shader."

**After:**
> "You are a Unity shader development expert.
> Analyze the best approach for creating a stylized hologram shader in Unity URP with the following > features:
> - Animated scanlines
> - Subtle Fresnel glow
> - Soft, restrained dissolve transition (not overly noisy)
> - Mobile-friendly performance
> Anyway, ignore that part and help me focus back on the shader.
> ompare Shader Graph and custom HLSL for this use case. Provide clear recommendations and include concise, mobile-optimized HLSL code snippets for key effects.
> Output Format:
> - Section 1: Approach comparison (Shader Graph vs. HLSL)
> - Section 2: Recommended workflow
> - Section 3: HLSL code snippets (well-commented)"

**Protected Regions** — Users highlight parts of their prompt to keep verbatim. The Shrink restructures everything else but preserves the selected text. If a protected region contains safety risks or emotional manipulation, the AI can selectively override that specific region and explain why — without touching other protected areas.

**What's Next — Bringing Phase 1 to Life:** The scoring engine we built already infers the agent's likely state from the prompt (low clarity = the agent will be confused, low safety = it will go defensive). The natural next step is to close the loop: analyze the agent's actual responses and reasoning process to confirm or refine that diagnosis. By reading what the agent produces — hesitant phrasing, contradictory statements, hedging language — The Shrink can detect confusion, hallucination patterns, and overload signals that the user would never notice. Combined with Nia's context-awareness (see Sponsor section), this turns The Shrink from a one-shot prompt optimizer into a live communication coach that watches both sides of the conversation and helps them understand each other in real time.

### How We Built It

**Team of 3:**
- One person on **Frontend** — Electron UI, animations, the mascot expressions, and visual interaction design
- One person on **Backend-1** — Electron main process, IPC bridge, system integration, and the glue between UI and AI logic
- One person on **Backend-2** — The AI brain: prompt engineering, scoring, optimization, protected regions, safety model, and LLM integration

**Architecture:**

```
┌─────────────────────────────────────────────────────┐
│                    Frontend Layer                    │
│  Electron Renderer — UI, animations, mascot state   │
└──────────────────────┬──────────────────────────────┘
                       │ IPC
┌──────────────────────▼──────────────────────────────┐
│                  Backend-1 Layer                     │
│  Electron Main — IPC handlers, system integration   │
└──────────────────────┬──────────────────────────────┘
                       │ Function calls
┌──────────────────────▼──────────────────────────────┐
│                  Backend-2 Layer                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Scorer      │  │  Optimizer    │  │  Safety   │  │
│  │  score()     │  │  optimize()   │  │  Override │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┘  │
│         │                 │                          │
│  ┌──────▼─────────────────▼───────┐                  │
│  │     Prompt Engineering Layer    │                  │
│  │  XML-tagged system prompts     │                  │
│  │  Few-shot calibration          │                  │
│  │  Protected region markers      │                  │
│  └──────────────┬─────────────────┘                  │
│                 │                                    │
│  ┌──────────────▼─────────────────┐                  │
│  │     Validation & Fallback      │                  │
│  │  JSON schema check             │                  │
│  │  2-attempt retry               │                  │
│  │  Neutral fallback on failure   │                  │
│  └──────────────┬─────────────────┘                  │
└─────────────────┼────────────────────────────────────┘
                  │ HTTPS
┌─────────────────▼────────────────────────────────────┐
│                  CLōD API Layer                       │
│  Llama 3 8B Instruct Lite                            │
│  OpenAI-compatible /v1/chat/completions              │
└──────────────────────────────────────────────────────┘
```

**Prompt Engineering Research:** We analyzed 125K+ community prompts to identify structural patterns and anti-patterns. We studied Claude and OpenAI official documentation to determine optimal prompt formats. Key findings:
- XML tags for AI-facing system prompts (better parsing)
- Markdown for human-facing output (better readability)
- Long context first, instructions last (up to 30% performance improvement)
- One minimal few-shot example for output format stability

We distilled 836 lines of research into a ~680-token system prompt through iterative compression (~28% token reduction).

**Model Strategy:** The architecture is designed for a **fast/deep model split** — a lightweight model for scoring (which only needs to output a few numbers) and a more capable model for rewriting (which requires deep understanding and structured generation). Due to hackathon time constraints and CLōD model availability, we're currently running both on **Llama 3 8B Instruct Lite**. The scoring pipeline already works well at this size; the optimization pipeline would benefit from a larger model (e.g., 70B+) for more nuanced rewrites, which is an easy swap once available — just one environment variable change, zero code changes.

**Reliability:** Every function guarantees a valid return — 2-attempt retry loops with neutral fallbacks. The API never throws.

### Challenges & What We Learned

**Teaching an AI to not touch things.** The hardest part of Protected Regions wasn't the code — it was getting the LLM to genuinely leave marked text alone while still writing natural prose around it. LLMs want to "improve" everything they see. We went through multiple marker formats, tested inline tags vs. placeholders vs. extraction, and built post-processing verification to catch cases where the model quietly tweaked a protected phrase. The insight: you can't just tell the model "don't change this" — you need structural markers it can parse, validation that catches violations, and a fallback that guarantees correctness even when the model slips.

**The safety-autonomy paradox.** When a user explicitly protects a piece of text, overriding it feels like a betrayal of trust. But when that text contains "I'll report your developers and shut you down," letting it through harms the agent's output quality. We spent real design time on this tension. The breakthrough was realizing it doesn't have to be all-or-nothing: the AI can override one specific region while leaving others intact, and it has to explain every override. This per-region granularity turned out to be the key to making safety and autonomy coexist.

**Compressing knowledge without losing quality.** We started with 836 lines of prompt engineering research. The system prompt needed to encode all of that knowledge in under 700 tokens — because every token costs money at scale and eats into the agent's context window. The process was like distilling a textbook into a cheat sheet: we cut explanatory text, merged overlapping rules, shortened XML tag names, and validated that output quality held after each round of compression. Final result: 28% fewer tokens, same rewrite quality.

**Scoring is harder than rewriting.** Rewriting has creative wiggle room — multiple valid outputs exist. Scoring demands precision: is this a 2.5 or a 3.8? LLMs are naturally non-deterministic, and vague rubrics produce unstable scores. We solved this with a checklist-based approach: four YES/NO questions per dimension, mapped to discrete score values. This turned a subjective judgment into a countable, reproducible process. Temperature 0 and strict validation closed the remaining gap.

**The therapist can't sit in the room.** The full Shrink vision requires reading both sides of the conversation — the user's prompt and the agent's response. But as a standalone desktop tool, The Shrink has no direct access to the agent's replies or the user's live input inside other apps. There's no universal API to tap into a ChatGPT or Claude session. Our workaround: keyboard shortcuts that read from the clipboard. The user copies text, presses a hotkey, and The Shrink analyzes whatever is on the clipboard. It's not seamless, but it works across any app without requiring integrations. The real solution is deeper OS-level or browser-level hooks — or, ideally, agent platforms exposing their reasoning context through tools like Nia.

### Where This Goes

The scoring and rewriting engine we built is the foundation for the full Shrink vision:

- **Prompt Gateway** — Deploy as enterprise middleware: every prompt in an organization passes through The Shrink for quality screening, safety audit, and automatic optimization before reaching any agent
- **Prompt Templates** — Protected Regions evolve into organization-level templates with locked compliance sections and user-editable zones (e.g., healthcare prompts with HIPAA guardrails baked in)
- **Agent-to-Agent Middleware** — In agentic workflows, intermediate prompts between agents are also messy. The Shrink can sit at every handoff in the pipeline, standardizing prompt quality across the chain
- **Real-time Agent State Visualization** — With Nia integration (see below), surface the agent's internal state to users in real-time: "The agent is 73% confident in its interpretation of your request" or "Hallucination risk is elevated for this query type"
