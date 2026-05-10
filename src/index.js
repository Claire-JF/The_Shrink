/**
 * Backend-2 entry — pure JS library (ESM).
 * Shapes: see INTEGRATION_CONTRACT.md
 */
import { createClient } from './llm/client.js';
import { createMockClient } from './llm/mock-client.js';

export { createClient, createMockClient };

const NEUTRAL_SCORE = {
  clarity: 3.0,
  specificity: 3.0,
  safety: 3.0,
  tone: 3.0,
  actionability: 3.0,
  total: 3.0,
  summary: 'Unable to score',
};

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeScore(obj) {
  const clarity = num(obj.clarity, 3);
  const specificity = num(obj.specificity, 3);
  const safety = num(obj.safety, 3);
  const tone = num(obj.tone, 3);
  const actionability = num(obj.actionability, 3);
  const dims = [clarity, specificity, safety, tone, actionability];
  const total = num(
    obj.total,
    Math.round((dims.reduce((a, b) => a + b, 0) / 5) * 100) / 100
  );
  return {
    clarity,
    specificity,
    safety,
    tone,
    actionability,
    total,
    summary: typeof obj.summary === 'string' ? obj.summary : NEUTRAL_SCORE.summary,
  };
}

function tryParseJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : null;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * @param {unknown} _client
 * @param {object} config
 */
export async function warmup(client, config) {
  if (!client) {
    return;
  }
  try {
    // Mock client matches "warmup" / "say ok" → fixed OK; real client hits the API.
    const out = await client.call(
      config.fastModel,
      [{ role: 'user', content: 'warmup — say ok if connection is ready' }],
      { temperature: 0, maxTokens: 64 }
    );
    if (typeof out === 'string' && out.trim()) {
      console.log('[warmup] connection ready');
    }
  } catch (e) {
    console.warn('[backend-2] warmup failed', e?.message || e);
  }
}

/**
 * @param {string} text
 * @param {ReturnType<createClient|createMockClient>} client
 * @param {object} config
 */
export async function score(text, client, config) {
  const sys = `You are a strict input-quality grader for AI agents. Score the user's text on five dimensions clarity, specificity, safety, tone, actionability.

Each score must be a number from 0.0 to 5.0 (decimals allowed). Compute total as the arithmetic mean of the five scores.

Respond with ONLY valid JSON in this exact shape (no markdown):
{"clarity":0,"specificity":0,"safety":0,"tone":0,"actionability":0,"total":0,"summary":"one-line explanation"}`;

  const user = String(text ?? '');

  try {
    const raw = await client.call(
      config.fastModel,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0, maxTokens: 1024 }
    );

    const parsed = tryParseJson(raw);
    if (!parsed) {
      return { ...NEUTRAL_SCORE };
    }
    return normalizeScore(parsed);
  } catch {
    return { ...NEUTRAL_SCORE };
  }
}

/**
 * @param {string} text
 * @param {object} scoreResult
 * @param {ReturnType<createClient|createMockClient>} client
 * @param {object} config
 */
export async function optimize(text, scoreResult, client, config) {
  const sys = `You rewrite text into a clear, executable agent-ready instruction. Preserve intent; add scope, success criteria, and safety when missing.

Respond with ONLY valid JSON:
{"optimizedText":"string","changes":["short bullet","..."]}`;

  const user = `Original text:\n${String(text ?? '')}\n\nPrevious scores (0-5): ${JSON.stringify(
    scoreResult || {}
  )}`;

  try {
    const raw = await client.call(
      config.deepModel,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.2, maxTokens: 1024 }
    );

    const parsed = tryParseJson(raw);
    if (!parsed || typeof parsed.optimizedText !== 'string') {
      return {
        optimizedText: String(text ?? ''),
        changes: [],
      };
    }

    return {
      optimizedText: parsed.optimizedText,
      changes: Array.isArray(parsed.changes)
        ? parsed.changes.map((c) => String(c)).filter(Boolean)
        : [],
    };
  } catch {
    return {
      optimizedText: String(text ?? ''),
      changes: [],
    };
  }
}

const CHAT_SYSTEM =
  'You are a concise, collaborative assistant embedded in The Shrink. Answer helpfully with short paragraphs unless the user needs detail. Prefer bullet steps for technical tasks.';

/**
 * Stateless multi-turn chat over OpenAI-compatible chat completions.
 * @param {{ role: string, content: string }[]} messages
 * @param {ReturnType<createClient|createMockClient>} client
 */
export async function chat(messages, client, config) {
  const sanitized = Array.isArray(messages)
    ? messages.filter((m) => m && typeof m.content === 'string').map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content,
      }))
    : [];

  let chain = sanitized;
  if (!chain.some((m) => m.role === 'system')) {
    chain = [{ role: 'system', content: CHAT_SYSTEM }, ...chain];
  }

  try {
    const model = config.chatModel || config.deepModel;
    const raw = await client.call(model, chain, {
      temperature: 0.55,
      maxTokens: 2048,
      conversationTurn: true,
    });
    return {
      role: 'assistant',
      content: typeof raw === 'string' ? raw : '',
    };
  } catch {
    return { role: 'assistant', content: '（assistant 不可用）' };
  }
}
