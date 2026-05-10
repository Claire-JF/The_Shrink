/**
 * HTTP LLM client via official OpenAI SDK — CLōD / OpenAI / any OpenAI-compatible baseURL.
 * Matches Backend-2 handoff: createClient(config) → { call(model, messages, opts) }
 */
import OpenAI from 'openai';

export function createClient(config) {
  const openai = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  return {
    /**
     * @param {string} model
     * @param {{ role: string, content: string }[]} messages
     * @param {{ temperature?: number, maxTokens?: number }} [opts]
     */
    async call(model, messages, { temperature = 0, maxTokens = 1024 } = {}) {
      const res = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
      });
      return res.choices[0].message.content;
    },
  };
}
