/**
 * Desktop type declarations for the Companion Desktop Electron bridge.
 *
 * When running inside the Electron desktop shell, the preload script
 * exposes `window.companionDesktop` with these methods. In the browser
 * (PWA / web), this object does not exist.
 */

export interface FloatingNudgePayload {
  id: string;
  trigger: string;
  message: string;
  pose?: string;
  strictness?: string;
  metadata?: Record<string, unknown>;
}

export interface FloatingOverlayState {
  visible: boolean;
  paused: boolean;
  dnd: boolean;
  minimized: boolean;
  allowOverFullscreen: boolean;
  suppressedByFullscreen: boolean;
  authenticated: boolean;
}

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
  onNikkiVisibility: (callback: (visible: boolean) => void) => () => void;

  /** Listen for Nikki pause/resume from the system tray. */
  onNikkiPause: (callback: (paused: boolean) => void) => () => void;

  /** Toggle click-through on the floating Nikki window. */
  setFloatingIgnoreMouse: (ignore: boolean) => void;

  /** Move the floating Nikki window by (dx, dy) pixels. */
  moveFloatingWindow: (dx: number, dy: number) => void;

  /** Minimize or expand the floating Nikki overlay. */
  setFloatingMinimized: (minimized: boolean) => void;

  /** Hide the floating Nikki overlay. */
  hideFloatingNikki: () => void;

  /** Open the main Companion conversation window (optionally focused on a nudge). */
  openMainConversation: (nudgeId?: string) => void;

  /** Forward a meaningful nudge from the main window to the floating overlay. */
  forwardNudgeToFloating: (nudge: FloatingNudgePayload) => void;

  /** Listen for nudges pushed to the floating Nikki overlay. */
  onFloatingNudge: (callback: (nudge: FloatingNudgePayload) => void) => () => void;

  /** Listen for floating overlay state updates. */
  onFloatingState: (callback: (state: FloatingOverlayState) => void) => () => void;
}

declare global {
  interface Window {
    companionDesktop?: CompanionDesktopAPI;
  }
}

export {};
