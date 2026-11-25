/**
 * Companion Desktop — Session Watcher
 *
 * Monitors the renderer's Firebase auth state and connectivity.
 * Injects a small script into the renderer after navigation to:
 *   - Report auth state changes (login / logout / session expired)
 *   - Report online/offline connectivity changes
 *   - Listen for tray-driven Nikki visibility and pause commands
 *
 * This runs entirely via webContents.executeJavaScript — no extra
 * files need to be loaded in the renderer. The preload script provides
 * the IPC bridge; this module drives the renderer-side listeners.
 */

class SessionWatcher {
  /**
   * @param {import('electron').BrowserWindow | null} mainWindow
   */
  constructor(mainWindow) {
    this.mainWindow = mainWindow;

    if (mainWindow) {
      // Inject watchers after each navigation (page load / SPA route change).
      mainWindow.webContents.on("did-finish-load", () => {
        this._injectWatchers();
      });

      // Also inject on DOM ready for faster initial setup.
      mainWindow.webContents.on("dom-ready", () => {
        this._injectWatchers();
      });
    }
  }

  /**
   * Inject a one-time script into the renderer that sets up:
   *   1. Online/offline event listeners
   *   2. Firebase auth state observer (polls for Firebase auth object)
   *   3. Tray command listeners (Nikki visibility, pause)
   */
  _injectWatchers() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const script = `
      (function() {
        // Guard: only inject once per page load
        if (window.__companionDesktopWatchersInjected) return;
        window.__companionDesktopWatchersInjected = true;

        const desktop = window.companionDesktop;
        if (!desktop) return;

        // ── 1. Online / Offline ──────────────────────────────────────────
        function reportOnline() {
          desktop.reportOnlineStatus(navigator.onLine);
        }
        window.addEventListener('online', reportOnline);
        window.addEventListener('offline', reportOnline);
        reportOnline(); // initial report

        // ── 2. Firebase Auth State ───────────────────────────────────────
        // The Firebase auth object may not be ready immediately.
        // Poll until we can subscribe to onAuthStateChanged.
        let authUnsubscribe = null;
        function trySubscribeAuth() {
          try {
            // Access the Firebase auth instance from the app's module scope.
            // The Companion app exports firebaseAuth from @/lib/firebase/client.
            // In the browser bundle, we can find it via the global Firebase app.
            const apps = window.__FIREBASE_APPS__ || [];
            if (typeof firebase !== 'undefined' && firebase.auth) {
              const auth = firebase.auth();
              authUnsubscribe = auth.onAuthStateChanged(function(user) {
                desktop.reportAuthState({
                  authenticated: !!user,
                  uid: user ? user.uid : null,
                });
              });
              return true;
            }
          } catch (e) {
            // Not ready yet
          }

          // Alternative: check for the auth state via DOM observation.
          // The app redirects to /login when not authenticated.
          // We can detect auth by checking if we're on the login page.
          try {
            const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/signup';
            desktop.reportAuthState({
              authenticated: !isLoginPage,
              uid: null,
            });
          } catch (e) {
            // fallback
          }

          return false;
        }

        // Try immediately, then poll every 2 seconds for up to 30 seconds.
        if (!trySubscribeAuth()) {
          let attempts = 0;
          const authPollInterval = setInterval(function() {
            attempts++;
            if (trySubscribeAuth() || attempts > 15) {
              clearInterval(authPollInterval);
            }
          }, 2000);
        }

        // ── 3. Page navigation auth detection ────────────────────────────
        // For SPA navigation, also observe URL changes.
        let lastPathname = window.location.pathname;
        const pathObserver = new MutationObserver(function() {
          if (window.location.pathname !== lastPathname) {
            lastPathname = window.location.pathname;
            const isLoginPage = lastPathname === '/login' || lastPathname === '/signup';
            desktop.reportAuthState({
              authenticated: !isLoginPage,
              uid: null,
            });
          }
        });
        pathObserver.observe(document.body, { childList: true, subtree: true });

        // ── 4. Tray commands → Nikki overlay ─────────────────────────────
        if (desktop.onNikkiVisibility) {
          desktop.onNikkiVisibility(function(visible) {
            // Dispatch a custom event that NikkiProactivePresence can listen to.
            window.dispatchEvent(new CustomEvent('companion:desktop-nikki-visibility', {
              detail: { visible: visible }
            }));
          });
        }

        if (desktop.onNikkiPause) {
          desktop.onNikkiPause(function(paused) {
            window.dispatchEvent(new CustomEvent('companion:desktop-nikki-pause', {
              detail: { paused: paused }
            }));
          });
        }

        // ── 5. Session expiry detection ──────────────────────────────────
        // Listen for 401 responses that indicate session expiry.
        const originalFetch = window.fetch;
        window.fetch = function() {
          return originalFetch.apply(this, arguments).then(function(response) {
            if (response.status === 401) {
              desktop.reportAuthState({ authenticated: false, uid: null });
            }
            return response;
          });
        };

        console.log('[Companion Desktop] Session watchers initialized.');
      })();
    `;

    this.mainWindow.webContents.executeJavaScript(script).catch(() => {
      // May fail if page is navigating — safe to ignore.
    });
  }

  /**
   * Update the window reference (e.g. if window is recreated).
   * @param {import('electron').BrowserWindow} newWindow
   */
  setWindow(newWindow) {
    this.mainWindow = newWindow;
    if (newWindow) {
      newWindow.webContents.on("did-finish-load", () => {
        this._injectWatchers();
      });
    }
  }
}

module.exports = { SessionWatcher };
