export async function warmup(client, config) {
  try {
    const model = config.fastModel || 'Qwen2.5 7B';
    await client.call(model, [{ role: 'user', content: 'Say OK' }], {
      temperature: 0,
      maxTokens: 4,
    });
    console.log('[warmup] connection ready');
  } catch (err) {
    console.warn('[warmup] failed (non-blocking):', err.message);
  }
}
