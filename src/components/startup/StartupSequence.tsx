"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { useProfile } from "@/context/ProfileContext";
import { ease } from "@/lib/motion";

const APP_ROUTES = ["/dashboard", "/plan", "/focus", "/journal", "/memories", "/settings"];
const SEEN_KEY = "companion:startup-seen";
/** Shortest time the moment is shown, so it reads as intentional rather than a flash. */
const MIN_VISIBLE_MS = 1500;
/** Safety valve only — if the profile is somehow still loading, never trap the user behind the overlay. */
const MAX_VISIBLE_MS = 4000;

function readSeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage unavailable — worst case it shows again next load */
  }
}

/**
 * A short opening moment, shown once per browser session the first
 * time a signed-in user lands inside the app. It dismisses only once
 * the real profile load has finished (no fake progress) and at least
 * MIN_VISIBLE_MS has passed. Skipped entirely for reduced motion,
 * and on the landing / login / onboarding screens. Click or Escape
 * skips it.
 */
export function StartupSequence() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { loading } = useProfile();

  const [visible, setVisible] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [decided, setDecided] = useState(false);

  const inApp = APP_ROUTES.includes(pathname);
  const dismiss = useCallback(() => setVisible(false), []);

  // Decide once, on first arrival inside the app.
  useEffect(() => {
    if (decided || !inApp) return;
    setDecided(true);
    if (reduceMotion || readSeen()) return;
    markSeen();
    setVisible(true);
  }, [decided, inApp, reduceMotion]);

  useEffect(() => {
    if (!visible) return;
    const minTimer = window.setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    const maxTimer = window.setTimeout(dismiss, MAX_VISIBLE_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
      document.removeEventListener("keydown", onKey);
    };
  }, [visible, dismiss]);

  // Real readiness: auth + profile resolved. Also leave if the user was bounced out of the app (e.g. to /login).
  useEffect(() => {
    if (!visible) return;
    if (!inApp) dismiss();
    else if (minElapsed && !loading) dismiss();
  }, [visible, inApp, minElapsed, loading, dismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="startup"
          role="status"
          aria-live="polite"
          aria-label="Opening Companion"
          onClick={dismiss}
          className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-5 bg-surface-primary"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: ease.standard } }}
        >
          <motion.div
            className="h-28 w-28"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.5, delay: 0.15, ease: ease.gentle } }}
          >
            <CompanionCharacter pose="idle" className="h-full w-full" />
          </motion.div>

          <motion.p
            className="font-display text-lg font-semibold tracking-wide text-ink-primary"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1, ease: ease.standard } }}
          >
            Companion
          </motion.p>

          <motion.p
            className="text-sm text-ink-secondary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.4, delay: 0.7, ease: ease.standard } }}
          >
            Good to see you.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}