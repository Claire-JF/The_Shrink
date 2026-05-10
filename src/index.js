import 'dotenv/config';
import { createClient } from './llm/client.js';
import { createMockClient } from './llm/mock-client.js';
import { score } from './scorer.js';
import { optimize } from './optimizer.js';
import { warmup } from './warmup.js';

const config = {
  baseURL: process.env.LLM_BASE_URL || 'https://api.clod.io/v1',
  apiKey: process.env.CLOD_API_KEY,
  fastModel: process.env.LLM_FAST_MODEL || 'Qwen2.5 7B',
  deepModel: process.env.LLM_DEEP_MODEL || 'Qwen2.5 72B',
};

const client = config.apiKey ? createClient(config) : createMockClient();

export { score, optimize, warmup, client, config, createClient, createMockClient };
