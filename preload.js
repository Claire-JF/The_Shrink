/**
 * Preload — exposes only invoke channels (Backend-1 contract to renderer).
 */
const { contextBridge, ipcRenderer } = require('electron');

const CHANNEL = {
  CAPTURE: 'shrink:capture-selection',
  GENERATE: 'shrink:generate-optimized',
  COPY: 'shrink:copy-to-clipboard',
  CLOSE: 'shrink:close-widget',
  GET_STATE: 'shrink:get-state',
  GET_CONFIG: 'shrink:get-config',
  OPEN_LOG: 'shrink:open-log',
  SCORE_LIVE: 'shrink:score-live',
  CHAT_SEND: 'shrink:chat-send',
  REPLACE: 'shrink:replace-with-optimized',
  FORWARD_PROMPT: 'shrink:forward-prompt',
  FORWARD_PREFS_GET: 'shrink:forward-prefs-get',
  FORWARD_PREFS_SET: 'shrink:forward-prefs-set',
};

contextBridge.exposeInMainWorld('shrink', {
  captureSelection: (opts) => ipcRenderer.invoke(CHANNEL.CAPTURE, opts ?? {}),
  generateOptimized: (payload) => ipcRenderer.invoke(CHANNEL.GENERATE, payload ?? {}),
  copyToClipboard: (payload) => ipcRenderer.invoke(CHANNEL.COPY, payload ?? {}),
  replaceWithOptimized: () => ipcRenderer.invoke(CHANNEL.REPLACE),
  closeWidget: () => ipcRenderer.invoke(CHANNEL.CLOSE),
  getState: () => ipcRenderer.invoke(CHANNEL.GET_STATE),
  getConfig: () => ipcRenderer.invoke(CHANNEL.GET_CONFIG),
  openLog: () => ipcRenderer.invoke(CHANNEL.OPEN_LOG),
  scoreLive: (payload) => ipcRenderer.invoke(CHANNEL.SCORE_LIVE, payload ?? {}),
  chatSend: (payload) => ipcRenderer.invoke(CHANNEL.CHAT_SEND, payload ?? {}),
  forwardPrompt: (payload) => ipcRenderer.invoke(CHANNEL.FORWARD_PROMPT, payload ?? {}),
  getForwardPrefs: () => ipcRenderer.invoke(CHANNEL.FORWARD_PREFS_GET),
  setForwardPrefs: (payload) =>
    ipcRenderer.invoke(CHANNEL.FORWARD_PREFS_SET, payload ?? {}),
  getWindowBounds: () => ipcRenderer.invoke('shrink:get-window-bounds'),
  setWindowPosition: (pos) => ipcRenderer.invoke('shrink:set-window-position', pos ?? {}),
  syncOrbContentSize: (dims) => ipcRenderer.invoke('shrink:sync-orb-content-size', dims ?? {}),
  onPresentation: (fn) => {
    if (typeof fn !== 'function') return () => {};
    const handler = (_event, msg) => {
      try {
        fn(msg);
      } catch {
        /* ignore */
      }
    };
    ipcRenderer.on('shrink:presentation', handler);
    return () => ipcRenderer.removeListener('shrink:presentation', handler);
  },
});
