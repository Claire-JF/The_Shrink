import OpenAI from 'openai';

export function createClient(config) {
  const openai = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  return {
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
