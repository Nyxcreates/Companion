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

  // ── Part 5C: Floating Nikki Overlay IPC ────────────────────────────────────

  /**
   * Toggle click-through on the floating Nikki window.
   * @param {boolean} ignore
   */
  setFloatingIgnoreMouse: (ignore) => {
    ipcRenderer.send("companion:floating-ignore-mouse", Boolean(ignore));
  },

  /**
   * Move the floating Nikki window by (dx, dy) pixels.
   * @param {number} dx
   * @param {number} dy
   */
  moveFloatingWindow: (dx, dy) => {
    if (typeof dx === "number" && typeof dy === "number") {
      ipcRenderer.send("companion:floating-move", { dx, dy });
    }
  },

  /**
   * Minimize or expand the floating Nikki overlay.
   * @param {boolean} minimized
   */
  setFloatingMinimized: (minimized) => {
    ipcRenderer.send("companion:floating-minimized", Boolean(minimized));
  },

  /**
   * Hide the floating Nikki overlay (user-controlled visibility).
   */
  hideFloatingNikki: () => {
    ipcRenderer.send("companion:floating-hide");
  },

  /**
   * Open the main Companion conversation window (optionally focused on a conversation or nudge).
   * @param {string | { conversationId?: string, nudgeId?: string }} [payload]
   */
  openMainConversation: (payload) => {
    const normalized =
      typeof payload === "string"
        ? { nudgeId: payload, conversationId: null, focusOnly: false }
        : {
            conversationId: typeof payload?.conversationId === "string" ? payload.conversationId : null,
            nudgeId: typeof payload?.nudgeId === "string" ? payload.nudgeId : null,
            focusOnly: Boolean(payload?.focusOnly),
          };
    ipcRenderer.send("companion:open-conversation", normalized);
  },

  /**
   * Read desktop-specific settings (autoLaunch, floatingVisible).
   */
  getDesktopSettings: () => ipcRenderer.invoke("companion:get-desktop-settings"),

  /**
   * Update desktop-specific settings (autoLaunch, floatingVisible).
   */
  setDesktopSettings: (settings) => ipcRenderer.invoke("companion:set-desktop-settings", settings),

  /**
   * Listen for main-process requests to open a specific conversationId.
   * @param {(conversationId: string) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onOpenConversationId: (callback) => {
    const handler = (_event, conversationId) => callback(conversationId);
    ipcRenderer.on("companion:open-conversation-id", handler);
    return () => ipcRenderer.removeListener("companion:open-conversation-id", handler);
  },

  /**
   * Forward a meaningful nudge from the main app to the floating Nikki overlay.
   * @param {object} nudge
   */
  forwardNudgeToFloating: (nudge) => {
    if (nudge && typeof nudge === "object") {
      ipcRenderer.send("companion:floating-nudge-forward", nudge);
    }
  },

  /**
   * Listen for nudges pushed to the floating Nikki overlay.
   * @param {(nudge: object) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onFloatingNudge: (callback) => {
    const handler = (_event, nudge) => callback(nudge);
    ipcRenderer.on("companion:floating-nudge", handler);
    return () => ipcRenderer.removeListener("companion:floating-nudge", handler);
  },

  /**
   * Listen for floating overlay state updates (minimized, paused, dnd, etc.).
   * @param {(state: object) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onFloatingState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("companion:floating-state", handler);
    return () => ipcRenderer.removeListener("companion:floating-state", handler);
  },
});
