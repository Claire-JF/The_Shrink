import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.CLOD_API_KEY,
});

const prompt = [
  { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No reasoning, no explanation, no markdown.' },
  { role: 'user', content: 'Return exactly: {"clarity": 4.5, "ok": true}' },
];

const models = [
  'Llama 3.1 8B',
  'Qwen2.5 7B',
  'Qwen2.5 72B',
  'GPT 4o mini',
  'GPT 4o',
  'Arcee Blitz',
  'Arcee Spark',
];

for (const model of models) {
  console.log(`\n=== ${model} ===`);
  try {
    const r = await openai.chat.completions.create({
      model,
      messages: prompt,
      temperature: 0,
      max_completion_tokens: 100,
    });
    console.log('Response:', r.choices[0].message.content);
    console.log('finish_reason:', r.choices[0].finish_reason);
  } catch (e) {
    console.log('ERROR:', e.message?.slice(0, 120));
  }
}
