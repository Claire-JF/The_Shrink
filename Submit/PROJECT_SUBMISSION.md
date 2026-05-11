# Hackathon Submission — Field by Field

---

## Project Name (60 chars max)

```
The Shrink — AI Therapist for Human-Agent Communication
```
(55 characters)

---

## Elevator Pitch (200 chars max)

```
An AI therapist that diagnoses human-agent miscommunication, rewrites prompts into agent-optimized structure, and lets users protect the parts they wrote deliberately — surgical control, not blind rewriting.
```
(199 characters)

---

## About the Project

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
> "hey can u help me write something for my boss about a raise idk what to say make it good"

**After:**
> "You are a professional communication specialist. Draft a formal email requesting a salary raise. Context: Recipient is direct manager. Tone: professional, confident. Include: appreciation, 2-3 justification points, specific ask. Format: Under 200 words."

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

**Model:** All LLM calls use **Llama 3 8B Instruct Lite** via CLōD API — lightweight enough for fast scoring responses, capable enough for quality prompt rewriting. Total cost per score + optimize cycle: ~$0.001.

**Reliability:** Every function guarantees a valid return — 2-attempt retry loops with neutral fallbacks. The API never throws.

### Challenges

- **Protected Regions reliability:** Getting the AI to preserve marked text verbatim while restructuring everything around it. We went through multiple marker formats and validation strategies before landing on inline markers with post-processing verification.
- **Safety vs. user autonomy:** Users protect text for a reason, but sometimes that text contains threats. We designed a three-layer system that respects user intent by default but can override individual regions when necessary.
- **Token budget vs. prompt quality:** Compressed the system prompt through iterative distillation, cutting ~28% of tokens while maintaining output quality.
- **Scoring consistency:** Used temperature 0, checklist-based rubric mapping YES/NO counts to discrete scores, and validation that rejects out-of-range values.

### What We Learned

- Agents perform measurably better with structured input — even prompts scoring 5.0/5.0 benefit from restructuring
- The biggest win isn't making prompts longer — it's making them unambiguous
- Protected Regions bridge the gap between "fully automated rewriting" and "users keeping control," which is critical for trust
- The three dimensions (Clarity, Safety, Emotional Balance) turned out to be surprisingly effective proxies for predicting agent behavior: low clarity → agent guesses, low safety → agent defends, low emotion balance → agent destabilizes

### Where This Goes

The scoring and rewriting engine we built is the foundation for the full Shrink vision:

- **Prompt Gateway** — Deploy as enterprise middleware: every prompt in an organization passes through The Shrink for quality screening, safety audit, and automatic optimization before reaching any agent
- **Prompt Templates** — Protected Regions evolve into organization-level templates with locked compliance sections and user-editable zones (e.g., healthcare prompts with HIPAA guardrails baked in)
- **Agent-to-Agent Middleware** — In agentic workflows, intermediate prompts between agents are also messy. The Shrink can sit at every handoff in the pipeline, standardizing prompt quality across the chain
- **Real-time Agent State Visualization** — With Nia integration (see below), surface the agent's internal state to users in real-time: "The agent is 73% confident in its interpretation of your request" or "Hallucination risk is elevated for this query type"

---

## Built With

```
JavaScript, Node.js, Electron, OpenAI SDK, CLōD API, Llama 3 8B Instruct Lite
```

---

## "Try It Out" Links

- GitHub: `https://github.com/[your-org]/The_Shrink`

---

## Project Media

Suggested screenshots/GIFs (to create separately):
1. Before/after comparison — vague prompt → structured AI-Intent output
2. Protected Regions demo — user highlights text, AI rewrites around it
3. Safety override demo — harmful prompt gets neutralized
4. Scoring UI — three dimension scores mapping to agent states

---

## Additional Info (for judges)

**Hackathon theme alignment — "Build What Agents Want":**

The Shrink is built from the agent's perspective. We asked: what does an agent wish it could tell the user? "Your prompt is vague — I'm going to have to guess." "You're asking me to do something unsafe — I'm going into defensive mode." "Your emotional pressure isn't helping — it's making my output worse."

The Shrink makes that invisible agent experience visible, then fixes the communication gap. Rather than building another agent, we built the infrastructure that makes the human-agent relationship work better — for both sides.

**What makes it different from prompt rewriters:**

Most prompt tools treat the prompt as a string to optimize. The Shrink treats it as a **communication breakdown to diagnose**. The three scoring dimensions map directly to agent internal states (confusion, defensive mode, instability). Protected Regions preserve user intent with surgical precision. The three-layer safety model is, to our knowledge, the first implementation of per-region selective override in a prompt optimization tool.

---

### Sponsor Prize: Nia

**How we plan to integrate Nia:**

The Shrink's current scoring relies on analyzing the *prompt* to infer the agent's likely state. But Nia opens up a much more powerful approach: **direct agent introspection.**

We plan to use Nia's context-awareness capabilities to:

- **Read the agent's actual reasoning context** — not just the prompt, but the agent's chain-of-thought, attention patterns, and confidence levels during processing
- **Detect confusion in real-time** — when the agent's internal reasoning shows branching uncertainty or contradictory interpretations, surface this to the user as "The agent is unsure about X — try clarifying"
- **Predict hallucination risk** — analyze the agent's context window saturation and knowledge boundary signals to warn users before hallucination occurs, not after
- **Feed agent state back into optimization** — instead of scoring prompts in isolation, score them relative to the specific agent's current context and capabilities

This transforms The Shrink from a static prompt optimizer into a **live communication mediator** — reading the agent's mind in real-time and coaching the user on how to get the best out of it. Nia provides the missing piece: the ability to see inside the agent, not just the prompt going in.
