"use client";

/**
 * Floating Nikki Desktop Overlay Route (/desktop/floating)
 *
 * Rendered inside Electron's transparent, frameless, always-on-top BrowserWindow.
 * Compact proactive desktop companion: displays Nikki's animated character,
 * a short contextual reminder or check-in, and relevant action buttons.
 *
 * Does NOT contain any chat input, message composer, or conversation history.
 * Clicking "Talk to Nikki" creates a NEW conversation in the main Companion app.
 *
 * Electron requirements met:
 *  - No window.open / popup requirement (uses companionDesktop.openMainConversation IPC).
 *  - localStorage usage is guarded for Electron's sandboxed context.
 *  - CSS background is set transparent intentionally via inline style (not CSS class).
 *  - Falls back to an opaque "Nikki is loading…" card until auth resolves.
 *  - Shows a "Sign in" prompt if the user is not authenticated.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Minimize2, Maximize2, X, Move, Clock, Check, WifiOff, LogIn } from "lucide-react";
import { CompanionCharacter, type CompanionPose } from "@/components/character/CompanionCharacter";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/api/authFetch";
import type { FloatingNudgePayload, FloatingOverlayState } from "@/types/desktop";

const AUTO_COLLAPSE_MS = 90_000;
const NUDGE_POLL_MS = 45_000;

type ReminderKind = "sleep" | "study" | "hobby" | "upcoming" | "checkin";

function classifyTrigger(trigger?: string | null): ReminderKind {
  switch (trigger) {
    case "sleep_reminder":
    case "late_night":
    case "unusually_late":
      return "sleep";
    case "study_reminder":
    case "timetable_unstarted":
    case "deadline_approaching":
    case "task_overdue":
    case "task_unfinished":
    case "activity_missed":
      return "study";
    case "hobby_reminder":
      return "hobby";
    case "upcoming_activity":
      return "upcoming";
    default:
      return "checkin";
  }
}

function mapPose(raw?: string): CompanionPose {
  const valid: CompanionPose[] = [
    "idle",
    "walk",
    "turn",
    "wave",
    "lookAhead",
    "sit",
    "think",
    "celebrate",
    "sleepy",
    "concerned",
    "happy",
    "curious",
    "speaking",
  ];
  if (raw && valid.includes(raw as CompanionPose)) {
    return raw as CompanionPose;
  }
  return "idle";
}

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const FLOATING_SHOWN_KEYS_STORAGE = "companion:shown-floating-nudge-keys";
const FLOATING_SHOWN_TTL_MS = 48 * 60 * 60 * 1000;

/** localStorage helpers — guarded so they never throw in Electron's sandboxed renderer */
function readFloatingShownKeys(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(FLOATING_SHOWN_KEYS_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const cutoff = Date.now() - FLOATING_SHOWN_TTL_MS;
    const pruned: Record<string, number> = {};
    for (const [k, ts] of Object.entries(parsed)) {
      if (typeof ts === "number" && ts >= cutoff) pruned[k] = ts;
    }
    return pruned;
  } catch {
    // localStorage may throw in some sandboxed Electron contexts; degrade gracefully
    return {};
  }
}

function hasShownFloatingKey(key: string): boolean {
  if (!key) return false;
  return Boolean(readFloatingShownKeys()[key]);
}

function markFloatingKeyShown(key: string): void {
  if (!key || typeof window === "undefined") return;
  try {
    const map = readFloatingShownKeys();
    map[key] = Date.now();
    localStorage.setItem(FLOATING_SHOWN_KEYS_STORAGE, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

export default function FloatingNikkiPage() {
  const { firebaseUser, loading: authLoading } = useAuth();

  const [nudge, setNudge] = useState<FloatingNudgePayload | null>(null);
  const [overlayState, setOverlayState] = useState<FloatingOverlayState>({
    visible: true,
    paused: false,
    dnd: false,
    minimized: false,
    allowOverFullscreen: false,
    suppressedByFullscreen: false,
    authenticated: true,
  });
  const [isHovered, setIsHovered] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenNudgeIdRef = useRef<string | null>(null);

  // ── Task 2: Force html, body and every wrapper to background: transparent
  //   immediately on mount (overrides globals.css background & background-image).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevHtmlBgImg = html.style.backgroundImage;
    const prevBodyBg = body.style.background;
    const prevBodyBgImg = body.style.backgroundImage;
    html.style.background = "transparent";
    html.style.backgroundImage = "none";
    body.style.background = "transparent";
    body.style.backgroundImage = "none";
    body.style.overflow = "hidden";
    return () => {
      html.style.background = prevHtmlBg;
      html.style.backgroundImage = prevHtmlBgImg;
      body.style.background = prevBodyBg;
      body.style.backgroundImage = prevBodyBgImg;
    };
  }, []);

  // Report auth state directly from floating window so it works even if main window is closed
  useEffect(() => {
    if (authLoading) return;
    const isAuth = Boolean(firebaseUser);
    setOverlayState((prev) => ({ ...prev, authenticated: isAuth }));
    window.companionDesktop?.reportAuthState({
      authenticated: isAuth,
      uid: firebaseUser?.uid ?? null,
    });
  }, [firebaseUser, authLoading]);

  // Poll /api/nikki/nudge?evaluate=1
  const pollPendingNudge = useCallback(async () => {
    if (!firebaseUser || !navigator.onLine) return;
    try {
      const tz = encodeURIComponent(getTimezone());
      const res = await authFetch(`/api/nikki/nudge?evaluate=1&timezone=${tz}`);
      if (!res.ok) return;
      const json = await res.json();
      const data = json?.data;
      const dedupeKey = String(data?.idempotencyKey || data?.id || "");
      if (
        data?.id &&
        data.id !== lastSeenNudgeIdRef.current &&
        (!dedupeKey || !hasShownFloatingKey(dedupeKey))
      ) {
        lastSeenNudgeIdRef.current = data.id;
        if (dedupeKey) markFloatingKeyShown(dedupeKey);
        setActionError(null);
        setOverlayState((prev) => ({ ...prev, minimized: false }));
        window.companionDesktop?.setFloatingMinimized(false);
        setNudge({
          id: data.id,
          trigger: data.trigger,
          message: data.message,
          pose: data.pose || "speaking",
          strictness: data.strictness,
          metadata: data.metadata || {},
        });
      }
    } catch {
      // Ignore transient offline / network errors
    }
  }, [firebaseUser]);

  // Online / offline handling with automatic reconnect poll
  useEffect(() => {
    const syncOnline = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      window.companionDesktop?.reportOnlineStatus(online);
      if (online) {
        pollPendingNudge();
      }
    };
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, [pollPendingNudge]);

  // Auto-collapse bubble after inactivity so Nikki never obstructs desktop work
  useEffect(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (nudge && !isActing) {
      collapseTimerRef.current = setTimeout(() => {
        setNudge(null);
      }, AUTO_COLLAPSE_MS);
    }
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, [nudge, isActing]);

  // Clean up snooze backup timer on unmount
  useEffect(() => {
    return () => {
      if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    };
  }, []);

  // Listen to Electron main-process state & forwarded nudges
  useEffect(() => {
    const desktop = window.companionDesktop;
    if (!desktop) return;

    const unsubNudge = desktop.onFloatingNudge((incoming) => {
      if (incoming?.id) {
        lastSeenNudgeIdRef.current = incoming.id;
      }
      setActionError(null);
      setNudge(incoming);
    });

    const unsubState = desktop.onFloatingState((state) => {
      setOverlayState((prev) => ({ ...prev, ...state }));
      if (state.paused || state.dnd || !state.visible) {
        setNudge(null);
      }
    });

    return () => {
      unsubNudge();
      unsubState();
    };
  }, []);

  // Background polling independent of whether the Companion website is open
  useEffect(() => {
    if (
      !firebaseUser ||
      overlayState.paused ||
      overlayState.dnd ||
      !overlayState.visible ||
      overlayState.suppressedByFullscreen
    ) {
      return;
    }

    pollPendingNudge();
    const timer = setInterval(pollPendingNudge, NUDGE_POLL_MS);
    return () => clearInterval(timer);
  }, [
    firebaseUser,
    overlayState.paused,
    overlayState.dnd,
    overlayState.visible,
    overlayState.suppressedByFullscreen,
    pollPendingNudge,
  ]);

  // Dynamic click-through on transparent regions
  const handleMouseEnterInteractive = useCallback(() => {
    setIsHovered(true);
    window.companionDesktop?.setFloatingIgnoreMouse(false);
  }, []);

  const handleMouseLeaveInteractive = useCallback(() => {
    if (isDraggingRef.current) return;
    setIsHovered(false);
    window.companionDesktop?.setFloatingIgnoreMouse(true);
  }, []);

  // Drag-to-reposition using screen coordinates
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    lastPointerRef.current = { x: e.screenX, y: e.screenY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.screenX - lastPointerRef.current.x;
    const dy = e.screenY - lastPointerRef.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      dragMovedRef.current = true;
    }
    if (dx !== 0 || dy !== 0) {
      lastPointerRef.current = { x: e.screenX, y: e.screenY };
      window.companionDesktop?.moveFloatingWindow(dx, dy);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const clearLocalSnoozeTimer = () => {
    if (snoozeTimerRef.current) {
      clearTimeout(snoozeTimerRef.current);
      snoozeTimerRef.current = null;
    }
  };

  // Contextual Action Handlers
  const handleTalkToNikki = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (dragMovedRef.current || isActing) return;

      clearLocalSnoozeTimer();
      setIsActing(true);
      setActionError(null);

      try {
        if (!firebaseUser) {
          if (window.companionDesktop?.openMainConversation) {
            window.companionDesktop.openMainConversation({ nudgeId: nudge?.id });
          } else {
            window.open("/dashboard", "_blank");
          }
          setNudge(null);
          return;
        }

        let conversationId: string | undefined;
        try {
          const res = await authFetch("/api/nikki/nudge/action", {
            method: "POST",
            body: JSON.stringify({
              action: "talk",
              nudgeId: nudge?.id || undefined,
              trigger: nudge?.trigger || "general_checkin",
              message: nudge?.message || undefined,
              metadata: nudge?.metadata || {},
              timezone: getTimezone(),
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json?.data?.conversationId) {
            conversationId = json.data.conversationId as string;
          }
        } catch {
          // Fall back to opening the existing Companion chat page directly
        }

        setNudge(null);

        if (window.companionDesktop?.openMainConversation) {
          window.companionDesktop.openMainConversation({
            conversationId: conversationId || undefined,
            nudgeId: nudge?.id,
          });
        } else {
          const target = conversationId
            ? `/dashboard?conversationId=${encodeURIComponent(conversationId)}`
            : "/dashboard";
          window.open(target, "_blank");
        }
      } finally {
        setIsActing(false);
      }
    },
    [firebaseUser, isActing, nudge]
  );

  const handleSnooze = useCallback(
    async (e: React.MouseEvent, minutes?: number) => {
      e.stopPropagation();
      if (isActing) return;
      setIsActing(true);
      setActionError(null);

      const activeNudge = nudge;
      try {
        if (firebaseUser) {
          const res = await authFetch("/api/nikki/nudge/action", {
            method: "POST",
            body: JSON.stringify({
              action: "snooze",
              nudgeId: activeNudge?.id || undefined,
              trigger: activeNudge?.trigger || "general_checkin",
              minutes,
              timezone: getTimezone(),
            }),
          });
          const json = await res.json();
          const snoozedUntilIso = json?.data?.snoozedUntil;
          clearLocalSnoozeTimer();
          if (snoozedUntilIso) {
            const delayMs = Math.max(5_000, new Date(snoozedUntilIso).getTime() - Date.now() + 1500);
            snoozeTimerRef.current = setTimeout(() => {
              pollPendingNudge();
            }, delayMs);
          }
        }
        setNudge(null);
      } catch {
        setActionError("Snooze failed — check connection.");
      } finally {
        setIsActing(false);
      }
    },
    [firebaseUser, isActing, nudge, pollPendingNudge]
  );

  const handleAcknowledge = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isActing) return;
      clearLocalSnoozeTimer();
      setIsActing(true);
      const id = nudge?.id;
      const trigger = nudge?.trigger;
      setNudge(null);
      try {
        if (firebaseUser) {
          await authFetch("/api/nikki/nudge/action", {
            method: "POST",
            body: JSON.stringify({
              action: "acknowledge",
              nudgeId: id || undefined,
              trigger: trigger || "general_checkin",
              timezone: getTimezone(),
            }),
          });
        }
      } catch {
        // best-effort
      } finally {
        setIsActing(false);
      }
    },
    [firebaseUser, isActing, nudge]
  );

  const handleDismiss = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isActing) return;
      clearLocalSnoozeTimer();
      const id = nudge?.id;
      const trigger = nudge?.trigger;
      setNudge(null);
      try {
        if (firebaseUser) {
          await authFetch("/api/nikki/nudge/action", {
            method: "POST",
            body: JSON.stringify({
              action: "dismiss",
              nudgeId: id || undefined,
              trigger: trigger || "general_checkin",
              timezone: getTimezone(),
            }),
          });
        }
      } catch {
        // best-effort
      }
    },
    [firebaseUser, isActing, nudge]
  );

  const handleAvatarClick = useCallback(() => {
    if (dragMovedRef.current) return;
    if (overlayState.minimized) {
      setOverlayState((prev) => ({ ...prev, minimized: false }));
      window.companionDesktop?.setFloatingMinimized(false);
      return;
    }
    if (!nudge) {
      setActionError(null);
      setNudge({
        id: "",
        trigger: "general_checkin",
        message: firebaseUser
          ? "Heyyy, how have you been? Want to check in or open a chat?"
          : "Sign in to Companion to connect Nikki with your day.",
        pose: "wave",
      });
    }
  }, [firebaseUser, nudge, overlayState.minimized]);

  const handleToggleMinimize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = !overlayState.minimized;
      setOverlayState((prev) => ({ ...prev, minimized: next }));
      window.companionDesktop?.setFloatingMinimized(next);
      if (next) setNudge(null);
    },
    [overlayState.minimized]
  );

  const handleHideToTray = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNudge(null);
    window.companionDesktop?.hideFloatingNikki();
  }, []);

  const reminderKind = classifyTrigger(nudge?.trigger);
  const sleepSnoozeMins =
    typeof nudge?.metadata?.sleepReminderSnoozeMinutes === "number"
      ? nudge.metadata.sleepReminderSnoozeMinutes
      : 25;

  const currentPose: CompanionPose = isActing
    ? "think"
    : nudge
    ? mapPose(nudge.pose || "speaking")
    : isHovered
    ? "wave"
    : "idle";

  const floatingTransparencyStyle = (
    <style>{`
      html, body {
        background: transparent !important;
        background-image: none !important;
        background-color: transparent !important;
        overflow: hidden !important;
      }
    `}</style>
  );

  // Loading state: transparent background with Nikki's avatar + small loading bubble
  if (authLoading) {
    return (
      <div
        className="flex h-screen w-screen flex-col items-end justify-end p-3 select-none"
        style={{ background: "transparent" }}
      >
        {floatingTransparencyStyle}
        <div
          onMouseEnter={handleMouseEnterInteractive}
          onMouseLeave={handleMouseLeaveInteractive}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="mb-2 flex items-center gap-2 rounded-2xl border border-violet-400/40 bg-[#14132a]/95 px-3.5 py-2.5 text-xs text-white shadow-2xl backdrop-blur-md"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
          <span className="text-white/85">Nikki is loading…</span>
        </div>
        <div
          onMouseEnter={handleMouseEnterInteractive}
          onMouseLeave={handleMouseLeaveInteractive}
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          className="relative cursor-grab drop-shadow-[0_8px_20px_rgba(124,92,255,0.35)] active:cursor-grabbing"
        >
          <CompanionCharacter pose="idle" className="h-24 w-24" />
        </div>
      </div>
    );
  }

  // Not signed in: render Nikki's avatar + small "Open Companion to sign in" bubble
  if (!firebaseUser) {
    return (
      <div
        className="flex h-screen w-screen flex-col items-end justify-end p-3 select-none"
        style={{ background: "transparent" }}
      >
        {floatingTransparencyStyle}
        <div
          onMouseEnter={handleMouseEnterInteractive}
          onMouseLeave={handleMouseLeaveInteractive}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="mb-2 flex flex-col items-end gap-2 rounded-2xl border border-violet-400/40 bg-[#14132a]/95 px-3.5 py-3 text-sm text-white shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            <span className="text-[12.5px] text-white/90">Open Companion to sign in</span>
          </div>
          <button
            type="button"
            onClick={() => {
              window.companionDesktop?.openMainConversation({ focusOnly: true });
            }}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-1.5 text-[11.5px] font-medium text-white transition hover:bg-violet-400"
          >
            <LogIn className="h-3.5 w-3.5" />
            Open Companion
          </button>
        </div>
        <div
          onMouseEnter={handleMouseEnterInteractive}
          onMouseLeave={handleMouseLeaveInteractive}
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          className="relative cursor-grab drop-shadow-[0_8px_20px_rgba(124,92,255,0.35)] active:cursor-grabbing"
        >
          <CompanionCharacter pose="wave" className="h-24 w-24" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-screen flex-col items-end justify-end p-3 select-none"
      style={{ background: "transparent" }}
    >
      {floatingTransparencyStyle}
      {/* Compact Contextual Reminder / Check-in Card (NO chat input or history) */}
      <AnimatePresence>
        {nudge && !overlayState.minimized && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            onMouseEnter={handleMouseEnterInteractive}
            onMouseLeave={handleMouseLeaveInteractive}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="mb-2 w-[288px] rounded-2xl border border-white/15 bg-[#14132a]/95 p-3.5 text-sm text-white shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] leading-snug text-white/95">{nudge.message}</p>
              <button
                type="button"
                aria-label="Dismiss reminder"
                onClick={handleDismiss}
                className="shrink-0 rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {actionError && (
              <p className="mt-1.5 text-[11px] text-rose-300">{actionError}</p>
            )}

            {/* Contextual Action Buttons */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {reminderKind === "sleep" && (
                <>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={(e) => handleSnooze(e, sleepSnoozeMins)}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition hover:bg-white/20 disabled:opacity-50"
                  >
                    <Clock className="h-3 w-3 text-indigo-300" />
                    Snooze {sleepSnoozeMins} min
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleAcknowledge}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    I&apos;m going to sleep
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleTalkToNikki}
                    className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Talk to Nikki
                  </button>
                </>
              )}

              {reminderKind === "study" && (
                <>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleAcknowledge}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    Start studying
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={(e) => handleSnooze(e, 15)}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition hover:bg-white/20 disabled:opacity-50"
                  >
                    <Clock className="h-3 w-3" />
                    Snooze
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleTalkToNikki}
                    className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Talk to Nikki
                  </button>
                </>
              )}

              {reminderKind === "hobby" && (
                <>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleAcknowledge}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    Let&apos;s do it
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={(e) => handleSnooze(e, 30)}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition hover:bg-white/20 disabled:opacity-50"
                  >
                    <Clock className="h-3 w-3" />
                    Remind me later
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleTalkToNikki}
                    className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Talk to Nikki
                  </button>
                </>
              )}

              {reminderKind === "upcoming" && (
                <>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleAcknowledge}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    I&apos;m ready
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={(e) => handleSnooze(e, 10)}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition hover:bg-white/20 disabled:opacity-50"
                  >
                    <Clock className="h-3 w-3" />
                    Snooze
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleTalkToNikki}
                    className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Talk to Nikki
                  </button>
                </>
              )}

              {reminderKind === "checkin" && (
                <>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleAcknowledge}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    Done
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={(e) => handleSnooze(e, 15)}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition hover:bg-white/20 disabled:opacity-50"
                  >
                    <Clock className="h-3 w-3" />
                    Snooze 15 min
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleTalkToNikki}
                    className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Talk to Nikki
                  </button>
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/80 transition hover:bg-white/20 disabled:opacity-50"
                  >
                    Maybe later
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Nikki Avatar + Hover Controls */}
      <div
        onMouseEnter={handleMouseEnterInteractive}
        onMouseLeave={handleMouseLeaveInteractive}
        onClick={handleAvatarClick}
        className="group relative flex flex-col items-center"
      >
        {/* Subtle hover control bar (no-drag so all buttons remain clickable) */}
        <div
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className={`mb-1 flex items-center gap-1 rounded-full border border-white/15 bg-[#14132a]/90 px-2 py-0.5 shadow-lg backdrop-blur-md transition-opacity duration-150 ${
            isHovered ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <span className="px-1 text-white/50" title="Drag to move Nikki">
            <Move className="h-3 w-3" />
          </span>
          {!isOnline && (
            <span className="px-1 text-amber-300" title="Offline — waiting to reconnect">
              <WifiOff className="h-3 w-3" />
            </span>
          )}
          <button
            type="button"
            onClick={handleTalkToNikki}
            title="Talk to Nikki (open Companion chat)"
            className="inline-flex items-center gap-1 rounded-full bg-violet-500/80 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-violet-500"
          >
            <MessageCircle className="h-2.5 w-2.5" />
            Talk
          </button>
          <button
            type="button"
            onClick={handleToggleMinimize}
            title={overlayState.minimized ? "Expand Nikki" : "Minimize Nikki"}
            className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {overlayState.minimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={handleHideToTray}
            title="Minimize Nikki to system tray"
            className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-rose-300"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Minimized pill vs Animated CompanionCharacter (draggable via -webkit-app-region: drag) */}
        {overlayState.minimized ? (
          <div
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            className="flex h-12 w-12 cursor-grab items-center justify-center rounded-full border border-violet-400/40 bg-[#161533]/90 shadow-lg backdrop-blur-md active:cursor-grabbing"
          >
            <CompanionCharacter pose="idle" className="h-10 w-10" />
          </div>
        ) : (
          <div
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            className="relative cursor-grab drop-shadow-[0_8px_20px_rgba(124,92,255,0.35)] active:cursor-grabbing"
          >
            <CompanionCharacter pose={currentPose} className="h-24 w-24" />
          </div>
        )}
      </div>
    </div>
  );
}
