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
  MOCK_BAR_RESIZE: 'mock-ui:resize-bar',
  MOCK_DISMISS: 'mock-ui:dismiss-shell',
  FORWARD_PROMPT: 'shrink:forward-prompt',
  FORWARD_PREFS_GET: 'shrink:forward-prefs-get',
  FORWARD_PREFS_SET: 'shrink:forward-prefs-set',
};

contextBridge.exposeInMainWorld('shrink', {
  captureSelection: (opts) => ipcRenderer.invoke(CHANNEL.CAPTURE, opts ?? {}),
  generateOptimized: () => ipcRenderer.invoke(CHANNEL.GENERATE),
  copyToClipboard: (payload) => ipcRenderer.invoke(CHANNEL.COPY, payload ?? {}),
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

contextBridge.exposeInMainWorld('mockShell', {
  telemetry: (payload) => ipcRenderer.send('mock-ui:telemetry', payload),
  resizeBar: (heightPx) => ipcRenderer.invoke(CHANNEL.MOCK_BAR_RESIZE, { heightPx }),
  dismissBoth: () => ipcRenderer.invoke(CHANNEL.MOCK_DISMISS),
  subscribeOrb: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const wrapped = (_event, payload) => {
      try {
        callback(payload);
      } catch {
        /* ignore */
      }
    };
    ipcRenderer.on('mock-ui:orbit', wrapped);
    return () => ipcRenderer.removeListener('mock-ui:orbit', wrapped);
  },
});
