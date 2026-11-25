/**
 * Desktop type declarations for the Companion Desktop Electron bridge.
 *
 * When running inside the Electron desktop shell, the preload script
 * exposes `window.companionDesktop` with these methods. In the browser
 * (PWA / web), this object does not exist.
 */

export interface CompanionDesktopAPI {
  /** Always true when running in Electron. */
  isDesktop: true;

  /** Report Firebase auth state to the main process. */
  reportAuthState: (state: { authenticated: boolean; uid?: string | null }) => void;

  /** Report online/offline connectivity. */
  reportOnlineStatus: (isOnline: boolean) => void;

  /** Request a window action from the main process. */
  windowAction: (action: "minimize" | "hide" | "close") => void;

  /** Listen for Nikki visibility toggle from the system tray. */
  onNikkiVisibility: (callback: (visible: boolean) => void) => (() => void);

  /** Listen for Nikki pause/resume from the system tray. */
  onNikkiPause: (callback: (paused: boolean) => void) => (() => void);
}

declare global {
  interface Window {
    companionDesktop?: CompanionDesktopAPI;
  }
}

export {};
