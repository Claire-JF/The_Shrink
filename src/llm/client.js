/**
 * HTTP LLM client via OpenAI SDK — CLōD / OpenAI / any OpenAI-compatible baseURL.
 * createClient(config) → { call(model, messages, opts) }
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
     * @param {{ temperature?: number, maxTokens?: number, jsonMode?: boolean }} [opts]
     */
    async call(model, messages, { temperature = 0, maxTokens = 1024, jsonMode = false } = {}) {
      const params = {
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
      };
      if (jsonMode) {
        params.response_format = { type: 'json_object' };
      }
      const res = await openai.chat.completions.create(params);
      return res.choices[0].message.content;
    },
  };
}
