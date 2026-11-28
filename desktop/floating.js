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

const { BrowserWindow, screen, session } = require("electron");
const path = require("path");

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 520;
const EDGE_PADDING = 24;
const SNAP_THRESHOLD = 16;
const Z_ORDER_WATCHDOG_MS = 1500;
const SHOW_FALLBACK_TIMEOUT_MS = 2500;
const IS_NIKKI_DEBUG = process.env.NIKKI_DEBUG === "1";

function buildRetryFallbackHtml(targetUrl) {
  const safeUrl = JSON.stringify(targetUrl);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0; padding: 0; width: 100%; height: 100%;
    background: transparent; overflow: hidden;
    font-family: "Segoe UI", system-ui, sans-serif;
    display: flex; align-items: flex-end; justify-content: flex-end;
  }
  .card {
    margin: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(20, 19, 42, 0.94);
    border: 1px solid rgba(167, 139, 250, 0.45);
    color: #fff;
    font-size: 12px;
    display: flex; align-items: center; gap: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    -webkit-app-region: drag;
  }
  .dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: #a78bfa;
    box-shadow: 0 0 8px #a78bfa;
    flex-shrink: 0;
  }
  .btn {
    -webkit-app-region: no-drag;
    background: rgba(167, 139, 250, 0.25);
    border: 1px solid rgba(167, 139, 250, 0.6);
    color: #fff;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    cursor: pointer;
  }
  .btn:hover {
    background: rgba(167, 139, 250, 0.4);
  }
</style>
</head>
<body>
  <div class="card">
    <span class="dot"></span>
    <span>Nikki is loading…</span>
    <button class="btn" id="retry-btn" type="button">Retry</button>
  </div>
  <script>
    document.getElementById("retry-btn").addEventListener("click", function () {
      window.location.href = ${safeUrl};
    });
  </script>
</body>
</html>`;
}

function createSettingsStore() {
  try {
    const Store = require("electron-store");
    return new Store({
      name: "companion-floating",
      defaults: {
        x: null,
        y: null,
        displayId: null,
        visible: true,
        minimized: false,
        paused: false,
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
      visible: true,
      minimized: false,
      paused: false,
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

    this.visible =
      typeof options.startVisible === "boolean"
        ? options.startVisible
        : Boolean(this.store.get("visible", true));
    this.paused = Boolean(this.store.get("paused", false));
    this.dnd = Boolean(this.store.get("dnd", false));
    this.minimized = Boolean(this.store.get("minimized", false));
    this.allowOverFullscreen = Boolean(this.store.get("allowOverFullscreen", false));
    this.suppressedByFullscreen = false;
    this.authenticated = false;
    this._mainAuthenticated = false;
    this._lastAuthReloadAt = 0;
    this.isQuitting = false;

    this._fullscreenTimer = null;
    this._reloadTimer = null;
    this._zOrderTimer = null;
    this._showFallbackTimer = null;
    this._intentionalHide = false;
    this._usingFallbackPage = false;
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

    // ── Task 4: Ensure minimum size and correct initial position ────────
    const primary = screen.getPrimaryDisplay();
    const wa = primary.workArea;
    const initPos = {
      x: Math.max(pos.x, wa.x),
      y: Math.max(pos.y, wa.y),
    };

    const companionSession =
      typeof session?.fromPartition === "function"
        ? session.fromPartition("persist:companion")
        : undefined;

    this.window = new BrowserWindow({
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      minWidth: DEFAULT_WIDTH,
      minHeight: DEFAULT_HEIGHT,
      x: initPos.x,
      y: initPos.y,
      title: "Floating Nikki",
      type: process.platform === "win32" && !IS_NIKKI_DEBUG ? "toolbar" : undefined,
      transparent: !IS_NIKKI_DEBUG,
      frame: IS_NIKKI_DEBUG,
      autoHideMenuBar: true,
      alwaysOnTop: true,
      skipTaskbar: !IS_NIKKI_DEBUG,
      resizable: IS_NIKKI_DEBUG,
      movable: true,
      minimizable: false,
      maximizable: false,
      hasShadow: IS_NIKKI_DEBUG,
      focusable: IS_NIKKI_DEBUG ? true : false,
      show: false,
      // ── Task 4: In debug mode use opaque background; normal mode is transparent
      backgroundColor: IS_NIKKI_DEBUG ? "#14132a" : "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        // ── Task 3: Persist Firebase session across window reloads
        partition: "persist:companion",
        ...(companionSession ? { session: companionSession } : {}),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });

    if (typeof this.window.removeMenu === "function") {
      this.window.removeMenu();
    }

    // ── Task 4: In debug mode add a coloured border so the window is impossible to miss
    if (IS_NIKKI_DEBUG) {
      this.window.webContents.on("dom-ready", () => {
        if (!this.window || this.window.isDestroyed()) return;
        this.window.webContents.insertCSS(
          `html, body { outline: 3px solid #a78bfa !important; box-sizing: border-box !important; }`
        ).catch(() => {});
      });
    }

    if (IS_NIKKI_DEBUG) {
      this.window.webContents.openDevTools({ mode: "detach" });
    }

    // Keep above ordinary desktop windows (VS Code, Chrome, Word, etc.) and Windows desktop
    this._assertTopmost();
    this.window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: this.allowOverFullscreen,
    });

    // Default to click-through so transparent pixels never obstruct user work (disabled in NIKKI_DEBUG).
    this.window.setIgnoreMouseEvents(!IS_NIKKI_DEBUG, { forward: true });

    const floatingUrl = `${this.baseUrl.replace(/\/$/, "")}/desktop/floating`;
    this._usingFallbackPage = false;
    this.window.loadURL(floatingUrl);

    // Never leave the window permanently hidden if ready-to-show is delayed/blocked.
    if (this._showFallbackTimer) clearTimeout(this._showFallbackTimer);
    this._showFallbackTimer = setTimeout(() => {
      this._showFallbackTimer = null;
      this._syncVisibility();
    }, SHOW_FALLBACK_TIMEOUT_MS);

    const scheduleReload = () => {
      if (this.isQuitting || this._reloadTimer) return;
      this._reloadTimer = setTimeout(() => {
        this._reloadTimer = null;
        if (this.window && !this.window.isDestroyed()) {
          this._usingFallbackPage = false;
          this.window.loadURL(floatingUrl);
        }
      }, 10_000);
    };

    const showFallbackOverlay = () => {
      if (!this.window || this.window.isDestroyed() || this._usingFallbackPage) return;
      this._usingFallbackPage = true;
      this.window.setIgnoreMouseEvents(false);
      this.window.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(buildRetryFallbackHtml(floatingUrl))}`
      );
      this._syncVisibility();
    };

    this.window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      // -3 (ERR_ABORTED) occurs on normal redirects/reloads
      if (errorCode === -3) return;
      console.warn(`[Floating] did-fail-load (${errorCode}): ${errorDescription} url=${validatedURL}`);
      showFallbackOverlay();
      scheduleReload();
    });

    this.window.webContents.on("did-finish-load", () => {
      const currentUrl =
        typeof this.window?.webContents?.getURL === "function"
          ? this.window.webContents.getURL()
          : "";

      // ── Task 1: Diagnostic logging after every did-finish-load ──────────
      if (IS_NIKKI_DEBUG) {
        console.log(`[Floating] did-finish-load url=${currentUrl}`);

        // Log what actually rendered (title, href, body text, bg colour)
        const diagScript = `(function() {
          return {
            title: document.title,
            href: location.href,
            bodyText: (document.body && document.body.innerText
              ? document.body.innerText.slice(0, 300)
              : '').replace(/\\n/g, ' ').trim(),
            bodyBg: document.body
              ? getComputedStyle(document.body).backgroundColor
              : 'n/a',
          };
        })()`;

        this.window.webContents.executeJavaScript(diagScript)
          .then((info) => {
            console.log("[Floating] page-diag title    :", info.title);
            console.log("[Floating] page-diag href     :", info.href);
            console.log("[Floating] page-diag bodyText :", info.bodyText || "(empty)");
            console.log("[Floating] page-diag bodyBg   :", info.bodyBg);

            // Detect redirect to /login or similar auth gate
            if (typeof info.href === "string" && !info.href.includes("/desktop/floating")) {
              console.warn("[Floating] REDIRECT DETECTED — final URL is not /desktop/floating:", info.href);
            }
          })
          .catch(() => {});

        // Log window bounds, visibility, and primary display work area
        const bounds = typeof this.window.getBounds === "function" ? this.window.getBounds() : null;
        const isVis = typeof this.window.isVisible === "function" ? this.window.isVisible() : "?";
        console.log("[Floating] window bounds  :", JSON.stringify(bounds));
        console.log("[Floating] window isVisible:", isVis);

        try {
          const { screen } = require("electron");
          const primary = screen.getPrimaryDisplay();
          console.log("[Floating] primary workArea:", JSON.stringify(primary.workArea));
        } catch {}
      }

      if (currentUrl && !currentUrl.startsWith("data:")) {
        this._usingFallbackPage = false;
        this.window.setIgnoreMouseEvents(!IS_NIKKI_DEBUG, { forward: true });

        // ── Task 4: Re-clamp to screen on every real page load ──────────
        this.ensureOnScreenBounds();
      }
      this._syncVisibility();
    });

    this.window.webContents.on("render-process-gone", (_event, details) => {
      console.warn("[Floating] render-process-gone:", details?.reason);
      if (this.isQuitting) return;
      if (this.window && !this.window.isDestroyed()) {
        this.window.destroy();
      }
      this.window = null;
      setTimeout(() => {
        if (!this.isQuitting) this.create();
      }, 1000);
    });

    if (IS_NIKKI_DEBUG) {
      this.window.webContents.on("console-message", (_event, level, message) => {
        console.log(`[Floating renderer:${level}] ${message}`);
      });
    }

    this.window.once("ready-to-show", () => {
      if (IS_NIKKI_DEBUG) {
        console.log("[Floating] ready-to-show fired");
      }
      if (this._showFallbackTimer) {
        clearTimeout(this._showFallbackTimer);
        this._showFallbackTimer = null;
      }
      if (this._reloadTimer && !this._usingFallbackPage) {
        clearTimeout(this._reloadTimer);
        this._reloadTimer = null;
      }
      this._syncVisibility();
      this._pushStateToRenderer();
    });

    // Recover from Windows Show Desktop (Win+D) or accidental minimize/hide
    const recoverIfNeeded = () => {
      if (this.isQuitting || this._intentionalHide || !this.shouldShow()) return;
      setTimeout(() => {
        if (!this.window || this.window.isDestroyed()) return;
        if (this.isQuitting || this._intentionalHide || !this.shouldShow()) return;
        if (typeof this.window.isMinimized === "function" && this.window.isMinimized()) {
          this.window.restore();
        }
        if (!this.window.isVisible()) {
          this.window.showInactive();
        }
        this._assertTopmost();
      }, 80);
    };

    this.window.on("minimize", (event) => {
      if (typeof event?.preventDefault === "function") event.preventDefault();
      recoverIfNeeded();
    });
    this.window.on("hide", recoverIfNeeded);
    this.window.on("page-title-updated", (event) => {
      if (typeof event?.preventDefault === "function") event.preventDefault();
    });

    this.window.on("close", (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.setVisible(false);
      }
    });

    this.window.on("closed", () => {
      this.window = null;
      if (!this.isQuitting) {
        setTimeout(() => {
          if (!this.isQuitting) this.create();
        }, 1000);
      }
    });

    this._attachDisplayListeners();
    this._startFullscreenMonitor();
    this._startZOrderWatchdog();

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
    if (IS_NIKKI_DEBUG) {
      this.window.setIgnoreMouseEvents(false);
      return;
    }
    this.window.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.store.set("visible", this.visible);
    if (this.visible) {
      // Explicitly showing Nikki overrides pause/DND so "Show Nikki" always makes her visible
      this.paused = false;
      this.dnd = false;
      this.store.set("paused", false);
      this.store.set("dnd", false);
      if (!this.window || this.window.isDestroyed()) {
        this.create();
      }
      this.ensureOnScreenBounds();
    }
    this._syncVisibility({ forceShow: this.visible });
    this._pushStateToRenderer();
    this.onStateChange(this.getState());
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this.store.set("paused", this.paused);
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
    if (this.shouldShow() && (!this.window || this.window.isDestroyed())) {
      this.create();
    }
    if (this.window && !this.window.isDestroyed()) {
      this.window.setAlwaysOnTop(true, "screen-saver", 1);
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
   * Called when the main Companion window reports an auth state change.
   * If the main window just signed in while the floating window isn't
   * authenticated yet, reload the floating page once so it picks up the
   * shared IndexedDB Firebase Auth session from `persist:companion`.
   */
  onMainAuthChanged(authenticated) {
    const nextMainAuth = Boolean(authenticated);
    const prevMainAuth = this._mainAuthenticated;
    this._mainAuthenticated = nextMainAuth;

    if (nextMainAuth && !this.authenticated) {
      const now = Date.now();
      if (
        this.window &&
        !this.window.isDestroyed() &&
        !this._usingFallbackPage &&
        typeof this.window.webContents?.reload === "function" &&
        now - this._lastAuthReloadAt > 5000
      ) {
        this._lastAuthReloadAt = now;
        this.window.webContents.reload();
        return;
      }
    }

    if (!nextMainAuth && prevMainAuth && this.authenticated) {
      if (
        this.window &&
        !this.window.isDestroyed() &&
        !this._usingFallbackPage &&
        typeof this.window.webContents?.reload === "function"
      ) {
        this.window.webContents.reload();
        return;
      }
    }

    this.setAuthenticated(nextMainAuth);
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

  _assertTopmost() {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.setAlwaysOnTop(true, "screen-saver", 1);
    if (typeof this.window.moveTop === "function") {
      this.window.moveTop();
    }
  }

  _startZOrderWatchdog() {
    if (this._zOrderTimer) return;
    this._zOrderTimer = setInterval(() => {
      if (this.isQuitting || !this.shouldShow()) return;
      if (!this.window || this.window.isDestroyed()) {
        this.create();
        return;
      }
      if (typeof this.window.isMinimized === "function" && this.window.isMinimized()) {
        this.window.restore();
      }
      if (!this.window.isVisible()) {
        this.window.showInactive();
      }
      this._assertTopmost();
    }, Z_ORDER_WATCHDOG_MS);
  }

  ensureOnScreenBounds() {
    if (!this.window || this.window.isDestroyed()) return;
    const bounds = typeof this.window.getBounds === "function" ? this.window.getBounds() : null;
    if (!bounds) return;

    const displays = screen.getAllDisplays();
    const hasZeroSize = bounds.width < DEFAULT_WIDTH || bounds.height < DEFAULT_HEIGHT;
    const intersectsAny = displays.some((d) => {
      const wa = d.workArea;
      return (
        bounds.x < wa.x + wa.width &&
        bounds.x + bounds.width > wa.x &&
        bounds.y < wa.y + wa.height &&
        bounds.y + bounds.height > wa.y
      );
    });

    if (hasZeroSize || !intersectsAny) {
      const primary = screen.getPrimaryDisplay();
      const wa = primary.workArea;
      const width = Math.max(DEFAULT_WIDTH, bounds.width || DEFAULT_WIDTH);
      const height = Math.max(DEFAULT_HEIGHT, bounds.height || DEFAULT_HEIGHT);
      const x = Math.round(wa.x + wa.width - width - EDGE_PADDING);
      const y = Math.round(wa.y + wa.height - height - EDGE_PADDING);
      if (typeof this.window.setBounds === "function") {
        this.window.setBounds({ x, y, width, height });
      } else {
        this.window.setPosition(x, y);
      }
      this._savePosition(x, y, primary.id);
    }
  }

  bringToFront() {
    this.visible = true;
    this.paused = false;
    this.dnd = false;
    this.store.set("visible", true);
    this.store.set("paused", false);
    this.store.set("dnd", false);
    if (!this.window || this.window.isDestroyed()) {
      this.create();
    }
    this.ensureOnScreenBounds();
    this._syncVisibility({ forceShow: true, focus: true });
    this._assertTopmost();
    this._pushStateToRenderer();
    this.onStateChange(this.getState());
  }

  _syncVisibility(opts = {}) {
    if (!this.window || this.window.isDestroyed()) return;
    if (this.shouldShow()) {
      this._intentionalHide = false;
      if (typeof this.window.isMinimized === "function" && this.window.isMinimized()) {
        this.window.restore();
      }
      if (typeof this.window.setOpacity === "function") {
        this.window.setOpacity(1);
      }
      if (opts.forceShow && typeof this.window.show === "function") {
        this.window.show();
      } else if (!this.window.isVisible()) {
        // showInactive() displays Nikki over other apps without stealing focus
        this.window.showInactive();
      }
      this._assertTopmost();
      if (opts.focus && typeof this.window.focus === "function") {
        this.window.focus();
      }
    } else if (this.window.isVisible()) {
      this._intentionalHide = true;
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
    if (this._reloadTimer) {
      clearTimeout(this._reloadTimer);
      this._reloadTimer = null;
    }
    if (this._zOrderTimer) {
      clearInterval(this._zOrderTimer);
      this._zOrderTimer = null;
    }
    if (this._showFallbackTimer) {
      clearTimeout(this._showFallbackTimer);
      this._showFallbackTimer = null;
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
