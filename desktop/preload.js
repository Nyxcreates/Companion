/**
 * Companion Desktop — Preload Script
 *
 * Runs in a sandboxed renderer context with contextIsolation enabled.
 * Exposes a minimal, safe API to the web page via window.companionDesktop.
 *
 * Security:
 *  - No nodeIntegration.
 *  - contextIsolation = true.
 *  - Only explicitly allowed IPC channels are bridged.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("companionDesktop", {
  /**
   * Whether we're running inside the Electron desktop shell.
   * The web app can check `window.companionDesktop?.isDesktop` to adapt UI.
   */
  isDesktop: true,

  /**
   * Report the current Firebase auth state to the main process.
   * @param {{ authenticated: boolean, uid?: string }} state
   */
  reportAuthState: (state) => {
    ipcRenderer.send("companion:auth-state", {
      authenticated: Boolean(state?.authenticated),
      uid: state?.uid || null,
    });
  },

  /**
   * Report online/offline connectivity to the main process.
   * @param {boolean} isOnline
   */
  reportOnlineStatus: (isOnline) => {
    ipcRenderer.send("companion:online-status", Boolean(isOnline));
  },

  /**
   * Request a window action from the main process.
   * @param {"minimize" | "hide" | "close"} action
   */
  windowAction: (action) => {
    const allowed = ["minimize", "hide", "close"];
    if (allowed.includes(action)) {
      ipcRenderer.send("companion:window-action", action);
    }
  },

  /**
   * Listen for Nikki visibility toggle from tray menu.
   * @param {(visible: boolean) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onNikkiVisibility: (callback) => {
    const handler = (_event, visible) => callback(visible);
    ipcRenderer.on("companion:nikki-visibility", handler);
    return () => ipcRenderer.removeListener("companion:nikki-visibility", handler);
  },

  /**
   * Listen for Nikki pause/resume from tray menu.
   * @param {(paused: boolean) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onNikkiPause: (callback) => {
    const handler = (_event, paused) => callback(paused);
    ipcRenderer.on("companion:nikki-pause", handler);
    return () => ipcRenderer.removeListener("companion:nikki-pause", handler);
  },
});
