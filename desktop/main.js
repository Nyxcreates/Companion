/**
 * Companion Desktop — Electron Main Process
 *
 * Wraps the Companion web app in a native desktop window.
 * When the user closes the window, the app hides to the system tray
 * instead of quitting, keeping Nikki's background process alive.
 *
 * Key behaviours:
 *  1. Single-instance lock — prevents duplicate processes.
 *  2. Window close → hide to tray (not quit).
 *  3. Tray menu: Open | Show/Hide Nikki | Pause | Resume | Exit.
 *  4. IPC bridge for auth-state, session-expiry, and online/offline.
 *  5. Graceful shutdown on Windows logoff / restart.
 */

const electron = require("electron");
const path = require("path");

// If launched from an IDE terminal with ELECTRON_RUN_AS_NODE=1 (or via `node main.js`),
// `require("electron")` resolves to the binary path string instead of the Electron API.
// Re-spawn cleanly with ELECTRON_RUN_AS_NODE deleted so Electron starts in GUI mode.
if (typeof electron === "string" || !electron.app) {
  const { spawn } = require("child_process");
  const cleanEnv = { ...process.env };
  delete cleanEnv.ELECTRON_RUN_AS_NODE;
  const electronBin =
    typeof electron === "string"
      ? electron
      : path.join(__dirname, "node_modules", "electron", "dist", "electron.exe");
  const child = spawn(electronBin, [__dirname, ...process.argv.slice(2)], {
    env: cleanEnv,
    stdio: "inherit",
    windowsHide: false,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  return;
}

const { app, BrowserWindow, ipcMain, nativeImage, Notification } = electron;
const { TrayManager } = require("./tray");
const { SessionWatcher } = require("./session");
const { FloatingManager } = require("./floating");
const { FullscreenDetector } = require("./fullscreen");

// ── Configuration ────────────────────────────────────────────────────────────

/** The URL to load in the main window. Defaults to production, with automatic local fallback if unreachable/404. */
let COMPANION_URL =
  process.env.COMPANION_URL || "https://companion-app-pied-chi.vercel.app";

async function resolveCompanionUrl() {
  if (process.env.COMPANION_URL) {
    return process.env.COMPANION_URL;
  }
  const prodUrl = "https://companion-app-pied-chi.vercel.app";
  const localUrl = "http://localhost:3000";
  try {
    const res = await fetch(`${prodUrl}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) return prodUrl;
  } catch {
    // Production unreachable; try local server
  }
  try {
    const localRes = await fetch(`${localUrl}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });
    if (localRes.ok) return localUrl;
  } catch {
    // Local server not running either; keep prodUrl
  }
  return prodUrl;
}

/** Minimum window dimensions */
const MIN_WIDTH = 420;
const MIN_HEIGHT = 640;

// ── Single-instance lock ─────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another instance is already running — focus it and quit this one.
  app.quit();
}

// ── State ────────────────────────────────────────────────────────────────────

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {TrayManager | null} */
let trayManager = null;

/** @type {SessionWatcher | null} */
let sessionWatcher = null;

/** @type {FloatingManager | null} */
let floatingManager = null;

/** @type {FullscreenDetector | null} */
let fullscreenDetector = null;

/** Whether the user genuinely chose "Exit Companion" (vs. window close). */
let isQuitting = false;

/** Whether the app was launched silently at Windows startup. */
const isStartupLaunch =
  process.argv.includes("--startup") || process.argv.includes("--hidden");

/** Whether Nikki overlay is currently shown in the renderer. */
let nikkiVisible = true;

/** Whether Nikki is paused (proactive nudges suppressed). */
let nikkiPaused = false;

// ── Window creation ──────────────────────────────────────────────────────────

function createMainWindow() {
  const iconPath = path.join(__dirname, "icons", "icon-256.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    icon = undefined;
  }

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: "Companion",
    icon,
    show: false, // Show after content loads to avoid flash
    backgroundColor: "#0b0b1e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadURL(COMPANION_URL);

  mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
    if (isQuitting || errorCode === -3) return;
    const safeUrl = JSON.stringify(COMPANION_URL);
    const retryHtml = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0b0b1e;color:#f8fafc;font-family:"Segoe UI",system-ui,sans-serif;gap:12px}button{padding:10px 20px;border-radius:999px;border:1px solid rgba(167,139,250,.6);background:rgba(167,139,250,.22);color:#fff;cursor:pointer;font-size:14px}button:hover{background:rgba(167,139,250,.38)}</style></head><body><h2>Couldn't connect to Companion</h2><p style="opacity:.75;font-size:13px">Check your internet connection and try again.</p><button id="retry" type="button">Retry</button><script>document.getElementById("retry").addEventListener("click",function(){window.location.href=${safeUrl};});</script></body></html>`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(retryHtml)}`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const current = mainWindow.webContents.getURL() || "";
        if (current.startsWith("data:") || current === "") {
          mainWindow.loadURL(COMPANION_URL);
        }
      }
    }, 10_000);
  });

  // Show once the page is ready (unless launched silently on Windows startup).
  mainWindow.once("ready-to-show", () => {
    if (!isStartupLaunch) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ── Hide on close (instead of quit) ──────────────────────────────────────
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      // On first hide, show a balloon so the user knows where the app went.
      if (trayManager && !trayManager.hasShownBalloon) {
        trayManager.showBalloon(
          "Companion is still running",
          "Nikki is in the system tray. Right-click the icon for options."
        );
        trayManager.hasShownBalloon = true;
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  COMPANION_URL = await resolveCompanionUrl();
  createMainWindow();

  // Set up floating Nikki overlay (Part 5C)
  fullscreenDetector = new FullscreenDetector();
  floatingManager = new FloatingManager({
    baseUrl: COMPANION_URL,
    fullscreenDetector,
    onStateChange: () => {
      if (trayManager) trayManager.updateMenu();
    },
  });
  nikkiVisible = floatingManager.visible;
  nikkiPaused = floatingManager.paused;
  floatingManager.create();

  // Set up system tray
  trayManager = new TrayManager({
    onOpen: () => showWindow(),
    onShowHideNikki: () => toggleNikki(),
    onBringNikkiToFront: () => bringNikkiToFront(),
    onTogglePause: () => togglePauseNikki(),
    onPause: () => pauseNikki(),
    onResume: () => resumeNikki(),
    onToggleDnd: () => toggleDnd(),
    onToggleAllowFullscreen: () => toggleAllowFullscreen(),
    onToggleAutoLaunch: () => toggleAutoLaunch(),
    onExit: () => exitApp(),
    getNikkiVisible: () => nikkiVisible,
    getNikkiPaused: () => nikkiPaused,
    getNikkiDnd: () => (floatingManager ? floatingManager.dnd : false),
    getAllowFullscreen: () =>
      floatingManager ? floatingManager.allowOverFullscreen : false,
    getAutoLaunch: () => getAutoLaunchEnabled(),
  });

  // Set up session watcher for auth/online status
  sessionWatcher = new SessionWatcher(mainWindow);

  // Register IPC handlers
  registerIPC();
});

// When the second instance tries to launch, focus the existing window.
app.on("second-instance", () => {
  showWindow();
});

// macOS: re-create window when dock icon clicked (not typical for Windows).
app.on("activate", () => {
  if (!mainWindow) {
    createMainWindow();
  } else {
    showWindow();
  }
});

// ── Windows shutdown / logoff ────────────────────────────────────────────────
// When Windows is shutting down, Electron receives 'before-quit'.
// We must set isQuitting = true so the close handler doesn't prevent it.
app.on("before-quit", () => {
  isQuitting = true;
});

// Ensure the app does NOT block Windows shutdown.
// The 'will-quit' event fires after all windows are closed.
app.on("will-quit", () => {
  if (trayManager) {
    trayManager.destroy();
    trayManager = null;
  }
});

// SIGTERM / SIGINT for graceful container or service-manager stops.
process.on("SIGTERM", () => exitApp());
process.on("SIGINT", () => exitApp());

// ── Window helpers ───────────────────────────────────────────────────────────

function showWindow() {
  console.log("[Main] showWindow()");
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    if (sessionWatcher) {
      sessionWatcher.setWindow(mainWindow);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
    return;
  }
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function exitApp() {
  console.log("[Main] exitApp()");
  isQuitting = true;
  if (floatingManager) {
    floatingManager.destroy();
    floatingManager = null;
  }
  if (trayManager) {
    trayManager.destroy();
    trayManager = null;
  }
  app.quit();
}

// ── Nikki visibility / pause / DND ───────────────────────────────────────────

function toggleNikki() {
  nikkiVisible = !nikkiVisible;
  console.log("[Main] toggleNikki() ->", nikkiVisible);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("companion:nikki-visibility", nikkiVisible);
  }
  if (floatingManager) {
    floatingManager.setVisible(nikkiVisible);
  }
  if (trayManager) trayManager.updateMenu();
}

function bringNikkiToFront() {
  console.log("[Main] bringNikkiToFront()");
  nikkiVisible = true;
  nikkiPaused = false;
  if (floatingManager) {
    floatingManager.bringToFront();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("companion:nikki-visibility", true);
    mainWindow.webContents.send("companion:nikki-pause", false);
  }
  if (trayManager) trayManager.updateMenu();
}

function togglePauseNikki() {
  if (nikkiPaused) {
    resumeNikki();
  } else {
    pauseNikki();
  }
}

function pauseNikki() {
  nikkiPaused = true;
  console.log("[Main] pauseNikki() -> true");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("companion:nikki-pause", true);
  }
  if (floatingManager) {
    floatingManager.setPaused(true);
    if (floatingManager.window && !floatingManager.window.isDestroyed()) {
      floatingManager.window.webContents.send("companion:nikki-pause", true);
    }
  }
  if (trayManager) trayManager.updateMenu();
}

function resumeNikki() {
  nikkiPaused = false;
  console.log("[Main] resumeNikki() -> false");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("companion:nikki-pause", false);
  }
  if (floatingManager) {
    floatingManager.setPaused(false);
    if (floatingManager.window && !floatingManager.window.isDestroyed()) {
      floatingManager.window.webContents.send("companion:nikki-pause", false);
    }
  }
  if (trayManager) trayManager.updateMenu();
}

function toggleDnd() {
  if (!floatingManager) return;
  const next = !floatingManager.dnd;
  console.log("[Main] toggleDnd() ->", next);
  floatingManager.setDnd(next);
  if (trayManager) trayManager.updateMenu();
}

function toggleAllowFullscreen() {
  if (!floatingManager) return;
  const next = !floatingManager.allowOverFullscreen;
  console.log("[Main] toggleAllowFullscreen() ->", next);
  floatingManager.setAllowOverFullscreen(next);
  if (trayManager) trayManager.updateMenu();
}

function getAutoLaunchEnabled() {
  try {
    return Boolean(app.getLoginItemSettings().openAtLogin);
  } catch {
    return false;
  }
}

function setAutoLaunchEnabled(enabled) {
  console.log("[Main] setAutoLaunchEnabled() ->", Boolean(enabled));
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      args: ["--startup"],
    });
    if (trayManager) trayManager.updateMenu();
  } catch {
    // Ignore on platforms where login items are unavailable
  }
}

function toggleAutoLaunch() {
  console.log("[Main] toggleAutoLaunch()");
  setAutoLaunchEnabled(!getAutoLaunchEnabled());
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

function registerIPC() {
  // The renderer reports auth state changes (login / logout / session expired).
  ipcMain.on("companion:auth-state", (_event, state) => {
    if (trayManager) {
      trayManager.setAuthState(state); // { authenticated: boolean }
    }
    if (floatingManager) {
      floatingManager.setAuthenticated(Boolean(state?.authenticated));
    }
  });

  // The renderer requests a window action.
  ipcMain.on("companion:window-action", (_event, action) => {
    switch (action) {
      case "minimize":
        mainWindow?.minimize();
        break;
      case "hide":
        mainWindow?.hide();
        break;
      case "close":
        mainWindow?.close();
        break;
    }
  });

  // The renderer reports connectivity.
  ipcMain.on("companion:online-status", (_event, isOnline) => {
    if (trayManager) {
      trayManager.setOnlineStatus(isOnline);
    }
  });

  // Handle synchronous check for desktop mode.
  ipcMain.handle("companion:is-desktop", () => true);

  // ── Part 5C: Floating Nikki IPC ────────────────────────────────────────────
  ipcMain.on("companion:floating-ignore-mouse", (_event, ignore) => {
    if (floatingManager) {
      floatingManager.setIgnoreMouse(Boolean(ignore));
    }
  });

  ipcMain.on("companion:floating-move", (_event, coords) => {
    if (
      floatingManager &&
      coords &&
      typeof coords.dx === "number" &&
      typeof coords.dy === "number"
    ) {
      floatingManager.moveBy(coords.dx, coords.dy);
    }
  });

  ipcMain.on("companion:floating-minimized", (_event, minimized) => {
    if (floatingManager) {
      floatingManager.setMinimized(Boolean(minimized));
    }
  });

  ipcMain.on("companion:floating-hide", () => {
    nikkiVisible = false;
    if (floatingManager) {
      floatingManager.setVisible(false);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("companion:nikki-visibility", false);
    }
    if (trayManager) trayManager.updateMenu();
  });

  ipcMain.on("companion:floating-nudge-forward", (_event, nudge) => {
    if (floatingManager) {
      floatingManager.showNudge(nudge);
    }
    // Also fire a native Windows toast so the user sees the nudge even when
    // the Companion PWA/website is not visible or is minimised.
    if (nudge && nudge.message && Notification.isSupported()) {
      try {
        const iconPath = path.join(__dirname, "icons", "icon-256.png");
        const toast = new Notification({
          title: "Nikki 💙",
          body: nudge.message,
          icon: iconPath,
          silent: false,
          timeoutType: "default",
        });
        toast.on("click", () => {
          showWindow();
        });
        toast.show();
      } catch {
        // Notifications not available in this environment — silent fail
      }
    }
  });

  ipcMain.on("companion:open-conversation", (_event, payload) => {
    showWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const conversationId = payload?.conversationId;
      const currentUrl = mainWindow.webContents.getURL() || "";

      if (currentUrl.includes("/dashboard")) {
        if (conversationId) {
          mainWindow.webContents.send("companion:open-conversation-id", conversationId);
        }
        return;
      }

      const base = COMPANION_URL.replace(/\/$/, "");
      const targetUrl = conversationId
        ? `${base}/dashboard?conversationId=${encodeURIComponent(conversationId)}`
        : `${base}/dashboard`;
      mainWindow.loadURL(targetUrl);
    }
  });

  ipcMain.handle("companion:get-desktop-settings", () => ({
    autoLaunch: getAutoLaunchEnabled(),
    floatingVisible: nikkiVisible,
  }));

  ipcMain.handle("companion:set-desktop-settings", (_event, settings) => {
    if (settings && typeof settings.autoLaunch === "boolean") {
      setAutoLaunchEnabled(settings.autoLaunch);
    }
    if (settings && typeof settings.floatingVisible === "boolean") {
      nikkiVisible = settings.floatingVisible;
      if (floatingManager) {
        floatingManager.setVisible(nikkiVisible);
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("companion:nikki-visibility", nikkiVisible);
      }
      if (trayManager) trayManager.updateMenu();
    }
    return {
      autoLaunch: getAutoLaunchEnabled(),
      floatingVisible: nikkiVisible,
    };
  });
}
