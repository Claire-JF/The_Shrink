const CHAT_SYSTEM =
  'You are a concise, collaborative assistant embedded in The Shrink. Answer helpfully with short paragraphs unless the user needs detail. Prefer bullet steps for technical tasks.';

/**
 * Stateless multi-turn chat over OpenAI-compatible chat completions.
 * @param {{ role: string, content: string }[]} messages
 */
export async function chat(messages, client, config) {
  const sanitized = Array.isArray(messages)
    ? messages
        .filter((m) => m && typeof m.content === 'string')
        .map((m) => ({
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
