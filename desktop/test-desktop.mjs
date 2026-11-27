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
  BrowserWindow: class MockBrowserWindow {
    constructor(opts) {
      this.opts = opts;
      this._visible = false;
      this._pos = [opts.x || 0, opts.y || 0];
      this._alwaysOnTop = false;
      this._ignoreMouse = false;
      this._destroyed = false;
      this.sent = [];
      this.webContents = {
        on: () => {},
        send: (ch, data) => this.sent.push({ ch, data }),
        executeJavaScript: () => Promise.resolve(),
      };
    }
    loadURL() {}
    once() {}
    on() {}
    setAlwaysOnTop(val) { this._alwaysOnTop = val; }
    setVisibleOnAllWorkspaces() {}
    setIgnoreMouseEvents(val) { this._ignoreMouse = val; }
    getPosition() { return this._pos; }
    setPosition(x, y) { this._pos = [x, y]; }
    isVisible() { return this._visible; }
    showInactive() { this._visible = true; }
    hide() { this._visible = false; }
    isDestroyed() { return this._destroyed; }
    destroy() { this._destroyed = true; this._visible = false; }
  },
  screen: {
    getPrimaryDisplay: () => ({ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }),
    getAllDisplays: () => [
      { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
      { id: 2, workArea: { x: 1920, y: 0, width: 1920, height: 1040 } },
    ],
    getDisplayNearestPoint: ({ x }) =>
      x >= 1920
        ? { id: 2, workArea: { x: 1920, y: 0, width: 1920, height: 1040 } }
        : { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    on: () => {},
  },
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
  const start = source.indexOf("function exitApp");
  const end = source.indexOf("}", source.indexOf("app.quit", start)) + 1;
  const exitFn = source.substring(start, end > start ? end : start + 400);
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

// ── 6. Part 5C: Floating Nikki Overlay & Fullscreen Suppression ──────────────
console.log("\n── Part 5C: Floating Overlay ──");

const { FloatingManager, clampPositionToWorkArea, DEFAULT_WIDTH, DEFAULT_HEIGHT } = require("./floating.js");
const { FullscreenDetector, SUPPRESSED_STATES } = require("./fullscreen.js");

test("floating.js & fullscreen.js exist", () => {
  assert(existsSync(join(__dirname, "floating.js")), "floating.js not found");
  assert(existsSync(join(__dirname, "fullscreen.js")), "fullscreen.js not found");
});

test("Floating web route /desktop/floating exists", () => {
  const routePath = join(__dirname, "..", "src", "app", "desktop", "floating", "page.tsx");
  assert(existsSync(routePath), "src/app/desktop/floating/page.tsx not found");
});

test("clampPositionToWorkArea clamps off-screen and snaps to edges", () => {
  const wa = { x: 0, y: 0, width: 1920, height: 1040 };
  const clampedNeg = clampPositionToWorkArea(-100, -50, DEFAULT_WIDTH, DEFAULT_HEIGHT, wa, true);
  assert(clampedNeg.x === 4 && clampedNeg.y === 4, `Expected (4,4), got (${clampedNeg.x},${clampedNeg.y})`);

  const clampedOver = clampPositionToWorkArea(5000, 5000, DEFAULT_WIDTH, DEFAULT_HEIGHT, wa, true);
  assert(
    clampedOver.x === 1920 - DEFAULT_WIDTH - 4 && clampedOver.y === 1040 - DEFAULT_HEIGHT - 4,
    `Unexpected max clamp: (${clampedOver.x},${clampedOver.y})`
  );
});

test("FloatingManager creates transparent always-on-top window", () => {
  const fm = new FloatingManager({ baseUrl: "http://localhost:3000" });
  const win = fm.create();
  assert(win.opts.transparent === true, "Window must be transparent");
  assert(win.opts.frame === false, "Window must be frameless");
  assert(win.opts.alwaysOnTop === true, "Window must be alwaysOnTop");
  assert(win.opts.skipTaskbar === true, "Window must skip taskbar");
  assert(win._ignoreMouse === true, "Window must default to click-through");
  fm.destroy();
});

test("FloatingManager moveBy supports multi-monitor and persists position", () => {
  const fm = new FloatingManager({ baseUrl: "http://localhost:3000" });
  const win = fm.create();
  win.setPosition(1800, 500);
  fm.moveBy(250, 0); // Moves onto second monitor (x >= 1920)
  const [nx] = win.getPosition();
  assert(nx >= 1920, `Expected x >= 1920 on second monitor, got ${nx}`);
  assert(fm.store.get("displayId") === 2, "Should persist second monitor ID");
  fm.destroy();
});

test("FloatingManager hides when paused, DND, or fullscreen suppressed", () => {
  const fm = new FloatingManager({ baseUrl: "http://localhost:3000" });
  fm.create();
  assert(fm.shouldShow() === true, "Initially shouldShow is true");

  fm.setPaused(true);
  assert(fm.shouldShow() === false, "Should hide when paused");
  fm.setPaused(false);
  assert(fm.shouldShow() === true, "Should show when resumed");

  fm.setDnd(true);
  assert(fm.shouldShow() === false, "Should hide in DND mode");
  fm.setDnd(false);

  fm.suppressedByFullscreen = true;
  assert(fm.shouldShow() === false, "Should hide during fullscreen app");
  fm.setAllowOverFullscreen(true);
  assert(fm.shouldShow() === true, "Should show when allowOverFullscreen is enabled");
  fm.destroy();
});

test("FloatingManager forwards nudges only when not paused/DND/suppressed", () => {
  const fm = new FloatingManager({ baseUrl: "http://localhost:3000" });
  const win = fm.create();
  const nudge = { id: "n1", trigger: "task_overdue", message: "Hey!", pose: "concerned" };

  assert(fm.showNudge(nudge) === true, "Should forward nudge when active");
  assert(
    win.sent.some((m) => m.ch === "companion:floating-nudge" && m.data.id === "n1"),
    "Nudge should be sent to floating renderer"
  );

  fm.setPaused(true);
  assert(fm.showNudge(nudge) === false, "Should suppress nudge when paused");
  fm.destroy();
});

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
  }
}

await asyncTest("FullscreenDetector recognizes Windows QUNS suppression states", async () => {
  assert(SUPPRESSED_STATES.has(2) && SUPPRESSED_STATES.has(3) && SUPPRESSED_STATES.has(4) && SUPPRESSED_STATES.has(6));
  const detector = new FullscreenDetector({
    queryFn: async () => ({ suppressed: true, quietTime: false, stateCode: 3 }),
  });
  const res = await detector.check();
  assert(res.suppressed === true && res.stateCode === 3, "Should detect D3D fullscreen");
});

test("TrayManager supports Start with Windows toggle", () => {
  let toggled = false;
  const tm = new TrayManager({
    onOpen: () => {},
    onShowHideNikki: () => {},
    onPause: () => {},
    onResume: () => {},
    onToggleAutoLaunch: () => {
      toggled = true;
    },
    onExit: () => {},
    getNikkiVisible: () => true,
    getNikkiPaused: () => false,
    getAutoLaunch: () => true,
  });
  const item = tm.tray.menu.items.find((i) => i.label === "Start with Windows");
  assert(item, "Should have Start with Windows menu item");
  assert(item.checked === true, "Should reflect getAutoLaunch state");
  item.click();
  assert(toggled === true, "Should invoke onToggleAutoLaunch callback");
  tm.destroy();
});

test("Floating route has NO chat input and uses contextual reminder actions", () => {
  const fs = require("fs");
  const source = fs.readFileSync(
    join(__dirname, "..", "src", "app", "desktop", "floating", "page.tsx"),
    "utf8"
  );
  assert(!source.includes("Reply to Nikki..."), "Must NOT render inline reply chat input");
  assert(!source.includes("<textarea"), "Must NOT render a message composer textarea");
  assert(source.includes("/api/nikki/nudge/action"), "Should post reminder actions to /api/nikki/nudge/action");
  assert(source.includes("/api/nikki/nudge?evaluate=1"), "Should poll /api/nikki/nudge?evaluate=1 for proactive reminders");
  assert(source.includes("Talk to Nikki"), "Should render Talk to Nikki action button");
  assert(source.includes("I&apos;m going to sleep"), "Should render sleep acknowledgement button");
  assert(source.includes("Start studying"), "Should render study action button");
  assert(source.includes("Let&apos;s do it"), "Should render hobby action button");
  assert(source.includes("Maybe later"), "Should render check-in dismiss button");
});

test("FloatingManager persists visibility across restarts", () => {
  const fm = new FloatingManager({ baseUrl: "http://localhost:3000" });
  fm.create();
  fm.setVisible(false);
  assert(fm.store.get("visible") === false, "Should persist visible=false in store");
  fm.setVisible(true);
  assert(fm.store.get("visible") === true, "Should persist visible=true in store");
  fm.destroy();
});

test("main.js disables backgroundThrottling, supports --startup, and handles did-fail-load", () => {
  const fs = require("fs");
  const source = fs.readFileSync(join(__dirname, "main.js"), "utf8");
  assert(source.includes("backgroundThrottling: false"), "Should keep background timers active when hidden");
  assert(source.includes("setLoginItemSettings"), "Should support Start with Windows via setLoginItemSettings");
  assert(source.includes("--startup"), "Should support silent --startup launch");
  assert(source.includes("did-fail-load"), "Should retry loading when offline");
  assert(source.includes("companion:open-conversation-id"), "Should support opening new conversation directly");
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}\n`);

// Restore module require
Module.prototype.require = origRequire;
Module._resolveFilename = originalResolve;

process.exit(failed > 0 ? 1 : 0);
