"use client";

/**
 * DesktopBridge — Integrates the Companion web app with the Electron desktop shell.
 *
 * This component is rendered once in the app layout and handles:
 *   1. Reporting Firebase auth state changes to the desktop main process.
 *   2. Reporting online/offline status.
 *   3. Listening for tray commands (Nikki visibility, pause/resume).
 *   4. Dispatching custom events that NikkiProactivePresence listens to.
 *
 * When running in the browser (not Electron), this component renders nothing
 * and performs no side effects.
 */

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import type {} from "@/types/desktop"; // Import for Window augmentation

/** Returns true if we're running inside the Electron desktop shell. */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.companionDesktop?.isDesktop);
}

export function DesktopBridge() {
  const { firebaseUser, loading } = useAuth();

  // ── 1. Report auth state to desktop shell ──────────────────────────────────
  useEffect(() => {
    if (!isDesktopApp() || loading) return;

    window.companionDesktop!.reportAuthState({
      authenticated: Boolean(firebaseUser),
      uid: firebaseUser?.uid ?? null,
    });
  }, [firebaseUser, loading]);

  // ── 2. Report online/offline status ────────────────────────────────────────
  useEffect(() => {
    if (!isDesktopApp()) return;

    const report = () => {
      window.companionDesktop!.reportOnlineStatus(navigator.onLine);
    };

    report(); // initial
    window.addEventListener("online", report);
    window.addEventListener("offline", report);

    return () => {
      window.removeEventListener("online", report);
      window.removeEventListener("offline", report);
    };
  }, []);

  // ── 3. Listen for tray → renderer commands ─────────────────────────────────
  useEffect(() => {
    if (!isDesktopApp()) return;

    const cleanups: (() => void)[] = [];

    // Nikki visibility toggle from tray
    const unsubVis = window.companionDesktop!.onNikkiVisibility((visible) => {
      window.dispatchEvent(
        new CustomEvent("companion:desktop-nikki-visibility", {
          detail: { visible },
        })
      );
    });
    cleanups.push(unsubVis);

    // Nikki pause/resume from tray
    const unsubPause = window.companionDesktop!.onNikkiPause((paused) => {
      window.dispatchEvent(
        new CustomEvent("companion:desktop-nikki-pause", {
          detail: { paused },
        })
      );
    });
    cleanups.push(unsubPause);

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  // This component has no visible UI.
  return null;
}
