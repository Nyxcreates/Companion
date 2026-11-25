/**
 * Companion Desktop — Floating Nikki Window Manager
 *
 * Manages a native transparent, frameless, always-on-top BrowserWindow
 * that displays Nikki above VS Code, Chrome, Word, and other desktop apps.
 *
 * Features:
 *  - Transparent background with dynamic click-through (setIgnoreMouseEvents)
 *  - Always-on-top ("screen-saver" level on Windows) without stealing focus
 *  - Position persistence across restarts via electron-store
 *  - Multi-monitor, DPI scaling, and screen-edge clamping
 *  - Drag-to-reposition with edge snapping
 *  - Full-screen / presentation / game suppression & Do-Not-Disturb mode
 */

const { BrowserWindow, screen } = require("electron");
const path = require("path");

const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 380;
const EDGE_PADDING = 18;
const SNAP_THRESHOLD = 16;

function createSettingsStore() {
  try {
    const Store = require("electron-store");
    return new Store({
      name: "companion-floating",
      defaults: {
        x: null,
        y: null,
        displayId: null,
        minimized: false,
        dnd: false,
        allowOverFullscreen: false,
      },
    });
  } catch {
    // Fallback in-memory store (e.g. in unit tests without electron-store)
    const data = {
      x: null,
      y: null,
      displayId: null,
      minimized: false,
      dnd: false,
      allowOverFullscreen: false,
    };
    return {
      get: (k, def) => (k in data ? data[k] : def),
      set: (k, v) => {
        data[k] = v;
      },
    };
  }
}

/**
 * Clamp (x, y) to a display's workArea so Nikki never goes off-screen
 * or hides behind the Windows taskbar, with optional edge snapping.
 */
function clampPositionToWorkArea(x, y, width, height, workArea, snap = true) {
  const minX = workArea.x + 4;
  const maxX = workArea.x + workArea.width - width - 4;
  const minY = workArea.y + 4;
  const maxY = workArea.y + workArea.height - height - 4;

  let clampedX = Math.max(minX, Math.min(x, Math.max(minX, maxX)));
  let clampedY = Math.max(minY, Math.min(y, Math.max(minY, maxY)));

  if (snap) {
    if (Math.abs(clampedX - minX) <= SNAP_THRESHOLD) clampedX = minX;
    if (Math.abs(clampedX - maxX) <= SNAP_THRESHOLD) clampedX = maxX;
    if (Math.abs(clampedY - minY) <= SNAP_THRESHOLD) clampedY = minY;
    if (Math.abs(clampedY - maxY) <= SNAP_THRESHOLD) clampedY = maxY;
  }

  return { x: Math.round(clampedX), y: Math.round(clampedY) };
}

class FloatingManager {
  /**
   * @param {object} options
   * @param {string} options.baseUrl
   * @param {import('./fullscreen').FullscreenDetector} [options.fullscreenDetector]
   * @param {(state: object) => void} [options.onStateChange]
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.fullscreenDetector = options.fullscreenDetector || null;
    this.onStateChange = options.onStateChange || (() => {});
    this.store = createSettingsStore();

    /** @type {BrowserWindow | null} */
    this.window = null;

    this.visible = true;
    this.paused = false;
    this.dnd = Boolean(this.store.get("dnd", false));
    this.minimized = Boolean(this.store.get("minimized", false));
    this.allowOverFullscreen = Boolean(this.store.get("allowOverFullscreen", false));
    this.suppressedByFullscreen = false;
    this.authenticated = false;
    this.isQuitting = false;

    this._fullscreenTimer = null;
    this._displayListenersAttached = false;
  }

  /**
   * Create the floating transparent BrowserWindow and start monitors.
   */
  create() {
    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }

    const pos = this._resolveInitialPosition();

    this.window = new BrowserWindow({
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      x: pos.x,
      y: pos.y,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      hasShadow: false,
      focusable: true,
      show: false,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });

    // Keep above ordinary desktop windows (VS Code, Chrome, Word, etc.)
    this.window.setAlwaysOnTop(true, "screen-saver");
    this.window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: this.allowOverFullscreen,
    });

    // Default to click-through so transparent pixels never obstruct user work.
    this.window.setIgnoreMouseEvents(true, { forward: true });

    const floatingUrl = `${this.baseUrl.replace(/\/$/, "")}/desktop/floating`;
    this.window.loadURL(floatingUrl);

    this.window.once("ready-to-show", () => {
      this._syncVisibility();
      this._pushStateToRenderer();
    });

    this.window.on("close", (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.setVisible(false);
      }
    });

    this.window.on("closed", () => {
      this.window = null;
    });

    this._attachDisplayListeners();
    this._startFullscreenMonitor();

    return this.window;
  }

  /**
   * Resolve initial window coordinates using saved position + multi-monitor validation.
   */
  _resolveInitialPosition() {
    const savedX = this.store.get("x", null);
    const savedY = this.store.get("y", null);
    const savedDisplayId = this.store.get("displayId", null);

    const displays = screen.getAllDisplays();
    let targetDisplay =
      (savedDisplayId != null && displays.find((d) => d.id === savedDisplayId)) ||
      null;

    if (typeof savedX === "number" && typeof savedY === "number") {
      if (!targetDisplay) {
        targetDisplay = screen.getDisplayNearestPoint({ x: savedX, y: savedY });
      }
      const clamped = clampPositionToWorkArea(
        savedX,
        savedY,
        DEFAULT_WIDTH,
        DEFAULT_HEIGHT,
        targetDisplay.workArea,
        false
      );
      return clamped;
    }

    const primary = screen.getPrimaryDisplay();
    const wa = primary.workArea;
    return {
      x: Math.round(wa.x + wa.width - DEFAULT_WIDTH - EDGE_PADDING),
      y: Math.round(wa.y + wa.height - DEFAULT_HEIGHT - EDGE_PADDING),
    };
  }

  /**
   * Re-clamp window if monitors are added/removed or Windows display scaling changes.
   */
  _attachDisplayListeners() {
    if (this._displayListenersAttached) return;
    this._displayListenersAttached = true;

    const reclamp = () => {
      if (!this.window || this.window.isDestroyed()) return;
      const [x, y] = this.window.getPosition();
      const display = screen.getDisplayNearestPoint({ x, y });
      const clamped = clampPositionToWorkArea(
        x,
        y,
        DEFAULT_WIDTH,
        DEFAULT_HEIGHT,
        display.workArea,
        false
      );
      this.window.setPosition(clamped.x, clamped.y);
      this._savePosition(clamped.x, clamped.y, display.id);
    };

    screen.on("display-metrics-changed", reclamp);
    screen.on("display-added", reclamp);
    screen.on("display-removed", reclamp);
  }

  /**
   * Poll full-screen / presentation / Windows Quiet Time status.
   */
  _startFullscreenMonitor() {
    if (!this.fullscreenDetector || this._fullscreenTimer) return;

    const poll = async () => {
      const res = await this.fullscreenDetector.check();
      const nextSuppressed = Boolean(res?.suppressed);
      if (nextSuppressed !== this.suppressedByFullscreen) {
        this.suppressedByFullscreen = nextSuppressed;
        this._syncVisibility();
        this._pushStateToRenderer();
        this.onStateChange(this.getState());
      }
    };

    poll();
    this._fullscreenTimer = setInterval(poll, 3500);
  }

  /**
   * Move window by (dx, dy) from a renderer drag gesture and persist position.
   */
  moveBy(dx, dy) {
    if (!this.window || this.window.isDestroyed()) return;
    const [curX, curY] = this.window.getPosition();
    const targetX = curX + dx;
    const targetY = curY + dy;

    const display = screen.getDisplayNearestPoint({
      x: targetX + Math.round(DEFAULT_WIDTH / 2),
      y: targetY + Math.round(DEFAULT_HEIGHT / 2),
    });

    const clamped = clampPositionToWorkArea(
      targetX,
      targetY,
      DEFAULT_WIDTH,
      DEFAULT_HEIGHT,
      display.workArea,
      true
    );

    this.window.setPosition(clamped.x, clamped.y);
    this._savePosition(clamped.x, clamped.y, display.id);
  }

  _savePosition(x, y, displayId) {
    this.store.set("x", x);
    this.store.set("y", y);
    if (displayId != null) {
      this.store.set("displayId", displayId);
    }
  }

  /**
   * Toggle click-through on transparent areas.
   */
  setIgnoreMouse(ignore) {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this._syncVisibility();
    this._pushStateToRenderer();
    this.onStateChange(this.getState());
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this._syncVisibility();
    this._pushStateToRenderer();
    this.onStateChange(this.getState());
  }

  setDnd(dnd) {
    this.dnd = Boolean(dnd);
    this.store.set("dnd", this.dnd);
    this._syncVisibility();
    this._pushStateToRenderer();
    this.onStateChange(this.getState());
  }

  setAllowOverFullscreen(allow) {
    this.allowOverFullscreen = Boolean(allow);
    this.store.set("allowOverFullscreen", this.allowOverFullscreen);
    if (this.window && !this.window.isDestroyed()) {
      this.window.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: this.allowOverFullscreen,
      });
    }
    this._syncVisibility();
    this._pushStateToRenderer();
    this.onStateChange(this.getState());
  }

  setMinimized(minimized) {
    this.minimized = Boolean(minimized);
    this.store.set("minimized", this.minimized);
    this._pushStateToRenderer();
    this.onStateChange(this.getState());
  }

  setAuthenticated(authenticated) {
    this.authenticated = Boolean(authenticated);
    this._syncVisibility();
    this._pushStateToRenderer();
  }

  /**
   * Whether the floating window should currently be shown on screen.
   */
  shouldShow() {
    if (!this.visible) return false;
    if (this.paused) return false;
    if (this.dnd) return false;
    if (this.suppressedByFullscreen && !this.allowOverFullscreen) return false;
    return true;
  }

  _syncVisibility() {
    if (!this.window || this.window.isDestroyed()) return;
    if (this.shouldShow()) {
      this.window.setAlwaysOnTop(true, "screen-saver");
      if (!this.window.isVisible()) {
        // showInactive() displays Nikki over other apps without stealing focus
        this.window.showInactive();
      }
    } else if (this.window.isVisible()) {
      this.window.hide();
    }
  }

  _pushStateToRenderer() {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.webContents.send("companion:floating-state", this.getState());
  }

  /**
   * Forward a meaningful nudge from the existing proactive brain to the floating overlay.
   */
  showNudge(nudge) {
    if (!nudge || this.paused || this.dnd) return false;
    if (this.suppressedByFullscreen && !this.allowOverFullscreen) return false;
    if (!this.visible) return false;

    this.minimized = false;
    this.store.set("minimized", false);
    this._syncVisibility();
    this._pushStateToRenderer();

    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send("companion:floating-nudge", nudge);
    }
    return true;
  }

  getState() {
    return {
      visible: this.visible,
      paused: this.paused,
      dnd: this.dnd,
      minimized: this.minimized,
      allowOverFullscreen: this.allowOverFullscreen,
      suppressedByFullscreen: this.suppressedByFullscreen,
      authenticated: this.authenticated,
    };
  }

  destroy() {
    this.isQuitting = true;
    if (this._fullscreenTimer) {
      clearInterval(this._fullscreenTimer);
      this._fullscreenTimer = null;
    }
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }
}

module.exports = {
  FloatingManager,
  clampPositionToWorkArea,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
};
