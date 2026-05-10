/**
 * Non-blocking API handshake — never throws.
 */
export async function warmup(client, config) {
  if (!client) {
    return;
  }
  try {
    await client.call(
      config.fastModel || 'DeepSeek V3',
      [{ role: 'user', content: 'warmup — say ok if connection is ready' }],
      { temperature: 0, maxTokens: 64 }
    );
    console.log('[warmup] connection ready');
  } catch (err) {
    console.warn('[warmup] failed (non-blocking):', err.message);
  }
}
