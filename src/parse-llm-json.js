/**
 * Strip optional markdown fences and parse JSON (best-effort).
 * @param {unknown} raw
 * @returns {object | null}
 */
export function parseLlmJson(raw) {
  if (typeof raw !== 'string') return null;
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  try {
    const o = JSON.parse(cleaned);
    return o && typeof o === 'object' ? o : null;
  } catch {
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        const o = JSON.parse(cleaned.slice(start, end + 1));
        return o && typeof o === 'object' ? o : null;
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}
