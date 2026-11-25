/**
 * Companion Desktop — System Tray Manager
 *
 * Creates and manages the Windows system tray icon and context menu.
 * The tray provides:
 *   - Open Companion
 *   - Show / Hide Nikki
 *   - Pause Nikki / Resume Nikki
 *   - ─── separator ───
 *   - Exit Companion
 *
 * The menu dynamically updates based on:
 *   - Nikki visibility state
 *   - Nikki pause state
 *   - Authentication state
 *   - Online/offline status
 */

const { Tray, Menu, nativeImage } = require("electron");
const path = require("path");

class TrayManager {
  /**
   * @param {object} callbacks
   * @param {() => void} callbacks.onOpen
   * @param {() => void} callbacks.onShowHideNikki
   * @param {() => void} callbacks.onPause
   * @param {() => void} callbacks.onResume
   * @param {() => void} [callbacks.onToggleDnd]
   * @param {() => void} [callbacks.onToggleAllowFullscreen]
   * @param {() => void} callbacks.onExit
   * @param {() => boolean} callbacks.getNikkiVisible
   * @param {() => boolean} callbacks.getNikkiPaused
   * @param {() => boolean} [callbacks.getNikkiDnd]
   * @param {() => boolean} [callbacks.getAllowFullscreen]
   */
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.hasShownBalloon = false;
    this.authenticated = false;
    this.online = true;
    this.tray = null;

    this._createTray();
  }

  _createTray() {
    const iconPath = path.join(__dirname, "icons", "tray-icon.png");
    let icon;
    try {
      icon = nativeImage.createFromPath(iconPath);
      // Resize for tray (Windows expects 16x16 or 32x32)
      icon = icon.resize({ width: 16, height: 16 });
    } catch {
      // Fallback: create a simple colored square
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip("Companion — Nikki is here ✨");

    // Double-click on tray icon opens the window (Windows convention).
    this.tray.on("double-click", () => {
      this.callbacks.onOpen();
    });

    this.updateMenu();
  }

  /**
   * Rebuild and apply the context menu based on current state.
   */
  updateMenu() {
    if (!this.tray) return;

    const nikkiVisible = this.callbacks.getNikkiVisible();
    const nikkiPaused = this.callbacks.getNikkiPaused();
    const nikkiDnd = this.callbacks.getNikkiDnd ? this.callbacks.getNikkiDnd() : false;
    const allowFullscreen = this.callbacks.getAllowFullscreen
      ? this.callbacks.getAllowFullscreen()
      : false;

    const statusLabel = this._getStatusLabel();

    const menuTemplate = [
      {
        label: "Open Companion",
        click: () => this.callbacks.onOpen(),
      },
      { type: "separator" },
      {
        label: nikkiVisible ? "Hide Nikki" : "Show Nikki",
        click: () => this.callbacks.onShowHideNikki(),
      },
      {
        label: "Pause Nikki",
        click: () => this.callbacks.onPause(),
        enabled: !nikkiPaused,
        visible: !nikkiPaused,
      },
      {
        label: "Resume Nikki",
        click: () => this.callbacks.onResume(),
        enabled: nikkiPaused,
        visible: nikkiPaused,
      },
      {
        label: "Do Not Disturb",
        type: "checkbox",
        checked: nikkiDnd,
        click: () => this.callbacks.onToggleDnd && this.callbacks.onToggleDnd(),
      },
      {
        label: "Allow Over Full-Screen",
        type: "checkbox",
        checked: allowFullscreen,
        click: () =>
          this.callbacks.onToggleAllowFullscreen &&
          this.callbacks.onToggleAllowFullscreen(),
      },
      { type: "separator" },
      {
        label: statusLabel,
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Exit Companion",
        click: () => this.callbacks.onExit(),
      },
    ];

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Returns a human-readable status line for the tray menu.
   */
  _getStatusLabel() {
    if (!this.online) return "⚠ Offline";
    if (!this.authenticated) return "⚠ Not signed in";
    const paused = this.callbacks.getNikkiPaused();
    if (paused) return "⏸ Nikki paused";
    const dnd = this.callbacks.getNikkiDnd ? this.callbacks.getNikkiDnd() : false;
    if (dnd) return "🌙 Do Not Disturb";
    return "✨ Nikki is active";
  }

  /**
   * Update authentication state and refresh the menu.
   * @param {{ authenticated: boolean }} state
   */
  setAuthState(state) {
    this.authenticated = Boolean(state?.authenticated);
    this.updateMenu();

    // Update tooltip
    if (this.tray) {
      this.tray.setToolTip(
        this.authenticated
          ? "Companion — Nikki is here ✨"
          : "Companion — Please sign in"
      );
    }
  }

  /**
   * Update online/offline status and refresh the menu.
   * @param {boolean} isOnline
   */
  setOnlineStatus(isOnline) {
    this.online = Boolean(isOnline);
    this.updateMenu();

    if (this.tray) {
      if (!this.online) {
        this.tray.setToolTip("Companion — Offline");
      } else {
        this.tray.setToolTip(
          this.authenticated
            ? "Companion — Nikki is here ✨"
            : "Companion — Please sign in"
        );
      }
    }
  }

  /**
   * Show a Windows balloon notification from the tray icon.
   * @param {string} title
   * @param {string} content
   */
  showBalloon(title, content) {
    if (!this.tray) return;
    this.tray.displayBalloon({
      title,
      content,
      iconType: "info",
    });
  }

  /**
   * Destroy the tray icon (called on app quit).
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = { TrayManager };
