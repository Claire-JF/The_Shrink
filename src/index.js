/**
 * Backend-2 — ESM entry. Electron brain.js dynamically imports this module.
 */
import { createClient } from './llm/client.js';
import { createMockClient } from './llm/mock-client.js';
import { score } from './scorer.js';
import { optimize } from './optimizer.js';
import { warmup } from './warmup.js';
import { chat } from './chat.js';

export { createClient, createMockClient, score, optimize, warmup, chat };
