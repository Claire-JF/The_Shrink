/**
 * Debounce orchestration reused by Mock Input Bar vs Workbench parity.
 */
(function attach(global) {
  const IDLE_MS = 1500;
  const CHAR_THRESHOLD = 40;
  const BURST_MS = 120;

  function structuralBreak(full, inserted) {
    const t = String(full || '');
    if (!t) return false;
    if (/[,，。；;·、]$/.test(t)) return true;
    if (/[\n\r]$/.test(t)) return true;
    if (inserted && /[\n\r]/.test(inserted)) return true;
    if (/\n\s*[-*•·]\s/.test(t)) return true;
    if (/\n\s*\d+[.)]\s/.test(t)) return true;
    return false;
  }

  function createLiveDebouncer() {
    let idleTimer = null;
    let burstTimer = null;

    function clearAll() {
      clearTimeout(idleTimer);
      clearTimeout(burstTimer);
      idleTimer = null;
      burstTimer = null;
    }

    return {
      reset(text, lenAtCloud, onIdle, onBurstMaybe) {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          if (typeof onIdle === 'function') {
            onIdle(String(text ?? ''));
          }
        }, IDLE_MS);

        const delta = Math.abs(String(text ?? '').length - lenAtCloud);
        if (delta >= CHAR_THRESHOLD && typeof onBurstMaybe === 'function') {
          clearTimeout(burstTimer);
          burstTimer = setTimeout(() => onBurstMaybe(String(text ?? '')), BURST_MS);
        }
      },
      pokeBurst(text, onBurstMaybe) {
        if (typeof onBurstMaybe !== 'function') return;
        clearTimeout(burstTimer);
        burstTimer = setTimeout(() => onBurstMaybe(String(text ?? '')), BURST_MS);
      },
      clear: clearAll,
      constants: { IDLE_MS, CHAR_THRESHOLD },
    };
  }

  global.MockLiveDebouncer = { structuralBreak, createLiveDebouncer };
})(typeof window !== 'undefined' ? window : globalThis);
