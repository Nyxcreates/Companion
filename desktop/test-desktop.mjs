/**
 * Companion Desktop — Integration Test Script
 *
 * Validates the desktop app's structure, module loading, and lifecycle
 * logic without requiring a running Electron instance. Tests the tray
 * manager, session watcher, and IPC bridge independently.
 *
 * Run: node test-desktop.mjs
 */

import { createRequire } from "module";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

console.log("\n🖥️  Companion Desktop — Integration Tests\n");

// ── 1. File structure ────────────────────────────────────────────────────────
console.log("── File Structure ──");

test("main.js exists", () => {
  assert(existsSync(join(__dirname, "main.js")), "main.js not found");
});

test("preload.js exists", () => {
  assert(existsSync(join(__dirname, "preload.js")), "preload.js not found");
});

test("tray.js exists", () => {
  assert(existsSync(join(__dirname, "tray.js")), "tray.js not found");
});

test("session.js exists", () => {
  assert(existsSync(join(__dirname, "session.js")), "session.js not found");
});

test("package.json exists", () => {
  assert(existsSync(join(__dirname, "package.json")), "package.json not found");
});

test("package.json has correct main entry", () => {
  const pkg = require("./package.json");
  assert(pkg.main === "main.js", `Expected main.js, got ${pkg.main}`);
});

test("package.json has electron dependency", () => {
  const pkg = require("./package.json");
  assert(
    pkg.devDependencies?.electron || pkg.dependencies?.electron,
    "electron not in dependencies"
  );
});

// ── 2. Module structure (mock Electron APIs) ─────────────────────────────────
console.log("\n── Module Logic (mocked Electron) ──");

// Mock Electron's Tray and Menu so we can test TrayManager logic.
const mockTrayInstance = {
  tooltip: "",
  menu: null,
  destroyed: false,
  balloonShown: null,
  setToolTip(tip) { this.tooltip = tip; },
  setContextMenu(menu) { this.menu = menu; },
  on(_event, _handler) { /* no-op */ },
  displayBalloon(opts) { this.balloonShown = opts; },
  destroy() { this.destroyed = true; },
};

// Inject mock before requiring tray.js
const Module = require("module");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "electron") {
    return request; // bypass real resolution
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Create a mock electron module
const mockElectron = {
  Tray: class MockTray {
    constructor() {
      Object.assign(this, { ...mockTrayInstance, destroyed: false, balloonShown: null });
    }
    setToolTip(tip) { this.tooltip = tip; }
    setContextMenu(menu) { this.menu = menu; }
    on() {}
    displayBalloon(opts) { this.balloonShown = opts; }
    destroy() { this.destroyed = true; }
  },
  Menu: {
    buildFromTemplate(template) {
      return { items: template };
    },
  },
  nativeImage: {
    createFromPath() {
      return {
        resize() { return this; },
      };
    },
    createEmpty() {
      return {
        resize() { return this; },
      };
    },
  },
};

// Override require for electron
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "electron") return mockElectron;
  return origRequire.apply(this, arguments);
};

// Now we can test TrayManager
const { TrayManager } = require("./tray.js");

test("TrayManager creates without error", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });
  assert(tm.tray !== null, "Tray was not created");
});

test("TrayManager tooltip shows Nikki active by default", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });
  assert(
    tm.tray.tooltip.includes("Nikki") || tm.tray.tooltip.includes("Companion"),
    `Unexpected tooltip: ${tm.tray.tooltip}`
  );
});

test("TrayManager menu has Open Companion item", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });
  const menu = tm.tray.menu;
  const labels = menu.items.map((i) => i.label).filter(Boolean);
  assert(labels.includes("Open Companion"), `Missing 'Open Companion': ${labels.join(", ")}`);
});

test("TrayManager menu has Exit Companion item", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });
  const menu = tm.tray.menu;
  const labels = menu.items.map((i) => i.label).filter(Boolean);
  assert(labels.includes("Exit Companion"), `Missing 'Exit Companion': ${labels.join(", ")}`);
});

test("TrayManager shows 'Hide Nikki' when visible", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });
  const labels = tm.tray.menu.items.map((i) => i.label).filter(Boolean);
  assert(labels.includes("Hide Nikki"), `Expected 'Hide Nikki': ${labels.join(", ")}`);
});

test("TrayManager shows 'Show Nikki' when hidden", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => false,
    getNikkiPaused: () => false,
  });
  const labels = tm.tray.menu.items.map((i) => i.label).filter(Boolean);
  assert(labels.includes("Show Nikki"), `Expected 'Show Nikki': ${labels.join(", ")}`);
});

test("TrayManager shows Pause when not paused, Resume when paused", () => {
  let isPaused = false;
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => isPaused,
  });

  // Initially: Pause visible, Resume hidden
  let items = tm.tray.menu.items.filter((i) => i.label);
  let pauseItem = items.find((i) => i.label === "Pause Nikki");
  let resumeItem = items.find((i) => i.label === "Resume Nikki");
  assert(pauseItem && pauseItem.visible !== false, "Pause should be visible when not paused");
  assert(resumeItem && resumeItem.visible === false, "Resume should be hidden when not paused");

  // After pausing
  isPaused = true;
  tm.updateMenu();
  items = tm.tray.menu.items.filter((i) => i.label);
  pauseItem = items.find((i) => i.label === "Pause Nikki");
  resumeItem = items.find((i) => i.label === "Resume Nikki");
  assert(pauseItem && pauseItem.visible === false, "Pause should be hidden when paused");
  assert(resumeItem && resumeItem.visible !== false, "Resume should be visible when paused");
});

test("TrayManager.setAuthState updates auth and refreshes menu", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });
  tm.setAuthState({ authenticated: true });
  assert(tm.authenticated === true, "Auth should be true");
  tm.setAuthState({ authenticated: false });
  assert(tm.authenticated === false, "Auth should be false");
  assert(
    tm.tray.tooltip.includes("sign in"),
    `Tooltip should mention sign in: ${tm.tray.tooltip}`
  );
});

test("TrayManager.setOnlineStatus updates status", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });
  tm.setOnlineStatus(false);
  assert(tm.online === false, "Should be offline");
  assert(
    tm.tray.tooltip.includes("Offline"),
    `Tooltip should show Offline: ${tm.tray.tooltip}`
  );
  tm.setOnlineStatus(true);
  assert(tm.online === true, "Should be online");
});

test("TrayManager.showBalloon sends balloon notification", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });
  tm.showBalloon("Test Title", "Test Content");
  assert(
    tm.tray.balloonShown && tm.tray.balloonShown.title === "Test Title",
    "Balloon should be shown"
  );
});

test("TrayManager.destroy cleans up tray", () => {
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });
  tm.destroy();
  assert(tm.tray === null, "Tray should be null after destroy");
});

test("TrayManager callbacks are invoked correctly", () => {
  let openCalled = false;
  let exitCalled = false;
  let toggleCalled = false;
  let pauseCalled = false;
  let resumeCalled = false;

  const tm = new TrayManager({
    onOpen: () => { openCalled = true; },
    onShowHideNikki: () => { toggleCalled = true; },
    onPause: () => { pauseCalled = true; },
    onResume: () => { resumeCalled = true; },
    onExit: () => { exitCalled = true; },
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
  });

  // Simulate clicking each menu item
  const items = tm.tray.menu.items.filter((i) => i.click);
  items.find((i) => i.label === "Open Companion")?.click();
  items.find((i) => i.label === "Exit Companion")?.click();
  items.find((i) => i.label === "Hide Nikki")?.click();
  items.find((i) => i.label === "Pause Nikki")?.click();

  assert(openCalled, "onOpen should have been called");
  assert(exitCalled, "onExit should have been called");
  assert(toggleCalled, "onShowHideNikki should have been called");
  assert(pauseCalled, "onPause should have been called");
});

// ── 3. SessionWatcher ────────────────────────────────────────────────────────
console.log("\n── SessionWatcher ──");

const { SessionWatcher } = require("./session.js");

test("SessionWatcher creates with null window", () => {
  const sw = new SessionWatcher(null);
  assert(sw.mainWindow === null, "Should accept null window");
});

test("SessionWatcher creates with mock window", () => {
  const mockWindow = {
    webContents: {
      on: () => {},
      executeJavaScript: () => Promise.resolve(),
    },
    isDestroyed: () => false,
  };
  const sw = new SessionWatcher(mockWindow);
  assert(sw.mainWindow === mockWindow, "Should store window reference");
});

test("SessionWatcher.setWindow updates reference", () => {
  const sw = new SessionWatcher(null);
  const mockWindow = {
    webContents: {
      on: () => {},
      executeJavaScript: () => Promise.resolve(),
    },
    isDestroyed: () => false,
  };
  sw.setWindow(mockWindow);
  assert(sw.mainWindow === mockWindow, "Window reference should be updated");
});

// ── 4. Lifecycle tests (conceptual / structural) ─────────────────────────────
console.log("\n── Lifecycle (structural) ──");

test("main.js is valid JavaScript", () => {
  const fs = require("fs");
  const source = fs.readFileSync(join(__dirname, "main.js"), "utf8");
  // Check key patterns exist
  assert(source.includes("requestSingleInstanceLock"), "Missing single-instance lock");
  assert(source.includes("before-quit"), "Missing before-quit handler");
  assert(source.includes("second-instance"), "Missing second-instance handler");
  assert(source.includes("isQuitting"), "Missing isQuitting flag");
  assert(source.includes("event.preventDefault"), "Missing close prevention");
  assert(source.includes("mainWindow.hide"), "Missing hide on close");
  assert(source.includes("SIGTERM"), "Missing SIGTERM handler");
});

test("preload.js exposes companionDesktop API", () => {
  const fs = require("fs");
  const source = fs.readFileSync(join(__dirname, "preload.js"), "utf8");
  assert(source.includes("companionDesktop"), "Missing companionDesktop");
  assert(source.includes("isDesktop"), "Missing isDesktop flag");
  assert(source.includes("reportAuthState"), "Missing reportAuthState");
  assert(source.includes("reportOnlineStatus"), "Missing reportOnlineStatus");
  assert(source.includes("onNikkiVisibility"), "Missing onNikkiVisibility");
  assert(source.includes("onNikkiPause"), "Missing onNikkiPause");
  assert(source.includes("contextIsolation"), "Should mention contextIsolation");
});

test("Window close hides instead of quitting (structural check)", () => {
  const fs = require("fs");
  const source = fs.readFileSync(join(__dirname, "main.js"), "utf8");
  // The close handler must check isQuitting and preventDefault
  const closeSection = source.substring(
    source.indexOf("mainWindow.on(\"close\""),
    source.indexOf("mainWindow.on(\"closed\"")
  );
  assert(closeSection.includes("isQuitting"), "Close handler should check isQuitting");
  assert(closeSection.includes("preventDefault"), "Close handler should preventDefault");
  assert(closeSection.includes("hide"), "Close handler should hide the window");
});

test("Exit sets isQuitting true before quit", () => {
  const fs = require("fs");
  const source = fs.readFileSync(join(__dirname, "main.js"), "utf8");
  const exitFn = source.substring(
    source.indexOf("function exitApp"),
    source.indexOf("function exitApp") + 200
  );
  assert(exitFn.includes("isQuitting = true"), "exitApp should set isQuitting = true");
  assert(exitFn.includes("app.quit"), "exitApp should call app.quit");
});

// ── 5. Web integration check ─────────────────────────────────────────────────
console.log("\n── Web Integration ──");

test("DesktopBridge.tsx exists for web app integration", () => {
  const bridgePath = join(__dirname, "..", "src", "components", "desktop", "DesktopBridge.tsx");
  assert(existsSync(bridgePath), "DesktopBridge.tsx not found at " + bridgePath);
});

test("Desktop type declarations exist", () => {
  const typesPath = join(__dirname, "..", "src", "types", "desktop.ts");
  assert(existsSync(typesPath), "desktop.ts types not found at " + typesPath);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

// Restore module require
Module.prototype.require = origRequire;
Module._resolveFilename = originalResolve;

process.exit(failed > 0 ? 1 : 0);
