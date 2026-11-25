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

const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
const path = require("path");
const { TrayManager } = require("./tray");
const { SessionWatcher } = require("./session");

// ── Configuration ────────────────────────────────────────────────────────────

/** The URL to load in the main window. Defaults to production. */
const COMPANION_URL =
  process.env.COMPANION_URL || "https://companion-app-pi-seven.vercel.app";

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

/** Whether the user genuinely chose "Exit Companion" (vs. window close). */
let isQuitting = false;

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
    },
  });

  mainWindow.loadURL(COMPANION_URL);

  // Show once the page is ready (avoids white flash).
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
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

app.whenReady().then(() => {
  createMainWindow();

  // Set up system tray
  trayManager = new TrayManager({
    onOpen: () => showWindow(),
    onShowHideNikki: () => toggleNikki(),
    onPause: () => pauseNikki(),
    onResume: () => resumeNikki(),
    onExit: () => exitApp(),
    getNikkiVisible: () => nikkiVisible,
    getNikkiPaused: () => nikkiPaused,
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
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function exitApp() {
  isQuitting = true;
  if (trayManager) {
    trayManager.destroy();
    trayManager = null;
  }
  app.quit();
}

// ── Nikki visibility / pause ─────────────────────────────────────────────────

function toggleNikki() {
  nikkiVisible = !nikkiVisible;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("companion:nikki-visibility", nikkiVisible);
  }
  if (trayManager) trayManager.updateMenu();
}

function pauseNikki() {
  nikkiPaused = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("companion:nikki-pause", true);
  }
  if (trayManager) trayManager.updateMenu();
}

function resumeNikki() {
  nikkiPaused = false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("companion:nikki-pause", false);
  }
  if (trayManager) trayManager.updateMenu();
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

function registerIPC() {
  // The renderer reports auth state changes (login / logout / session expired).
  ipcMain.on("companion:auth-state", (_event, state) => {
    if (trayManager) {
      trayManager.setAuthState(state); // { authenticated: boolean }
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
}
