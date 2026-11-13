"use client";

/**
 * Nikki Living Floating Overlay Component
 *
 * NOTE: This floating companion overlay operates client-side only while the application
 * is open and active in the browser or PWA window. It does NOT run as an OS background
 * process or floating system window when Companion is closed.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, MessageCircle, X, Clock, Calendar, Minimize2, Move, Eye, Hand, Coffee, Mic, MicOff, Send, BellOff } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { useProfile } from "@/context/ProfileContext";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { CompanionCharacter, type CompanionPose } from "./CompanionCharacter";
import { Button } from "@/components/ui/Button";
import type { ScheduleSummary } from "@/types/schedule";

const POSITION_STORAGE_KEY = "companion:nikki-floating-pos";
const LAST_INTERACTION_KEY = "companion:last-interaction-time";
const DISMISSED_GREETING_KEY = "companion:greeting-dismissed-session";
const SESSION_GREETING_KEY = "companion:session-greeting-shown";
const MINIMIZED_STORAGE_KEY = "companion:nikki-minimized";
const LAST_GREETING_TIME_KEY = "companion:last-greeting-time";
const LAST_GREETING_TEXT_KEY = "companion:last-greeting-text";
const LAST_CHAT_MESSAGE_KEY = "companion:last-chat-message-time";

/** sessionStorage key prefix for per-day timetable alert dedup */
const TIMETABLE_ALERT_PREFIX = "companion:timetable-alerts:";
/** sessionStorage key: user chose "Skip today" for timetable alerts */
const TIMETABLE_SKIP_TODAY_KEY = "companion:timetable-skip-today";
/** sessionStorage key: persists active break so page refresh doesn't forget it */
const BREAK_SESSION_KEY = "companion:break-session";

interface OpeningGreeting {
  id: string;
  message: string;
  subText?: string;
  pose: CompanionPose;
  actions: Array<{
    label: string;
    action: "talk" | "accept" | "dismiss";
    payload?: string;
    variant?: "primary" | "secondary" | "ghost";
  }>;
}

/** An in-app timetable alert bubble shown while the app is open */
interface TimetableAlert {
  key: string;        // unique dedup key stored in sessionStorage
  message: string;
  subText?: string;
  pose: CompanionPose;
}

/** Resolves the effective timezone from user profile or browser */
function getUserTimezone(profileTimezone?: string | null): string {
  if (profileTimezone && profileTimezone.trim()) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: profileTimezone.trim() });
      return profileTimezone.trim();
    } catch {
      // fallback
    }
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Returns today's ISO date string "YYYY-MM-DD" in the user's timezone */
function getTodayDateStr(tz?: string): string {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Returns local hours and minutes in the user's timezone */
function getLocalMinutes(tz: string): { hours: number; minutes: number; totalMinutes: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    return { hours: h, minutes: m, totalMinutes: h * 60 + m };
  } catch {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    return { hours: h, minutes: m, totalMinutes: h * 60 + m };
  }
}

/** sessionStorage key for set of shown alert keys per day */
function getShownAlertsStorageKey(dateStr: string): string {
  return `${TIMETABLE_ALERT_PREFIX}${dateStr}`;
}

/** Returns the set of shown alert keys for the given day from sessionStorage */
function getShownAlertKeysToday(dateStr: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(getShownAlertsStorageKey(dateStr));
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

/** Returns true if the alert key has already been shown today */
function isAlertShownToday(dateStr: string, alertKey: string): boolean {
  try {
    return getShownAlertKeysToday(dateStr).has(alertKey);
  } catch {
    return false;
  }
}

/** Mark an alert as shown for the day in the sessionStorage set */
function markAlertShownToday(dateStr: string, alertKey: string): void {
  try {
    const set = getShownAlertKeysToday(dateStr);
    set.add(alertKey);
    sessionStorage.setItem(getShownAlertsStorageKey(dateStr), JSON.stringify(Array.from(set)));
  } catch {
    // safe fallback
  }
}

/** Unmark an alert from today's set (e.g. when snoozed) */
function unmarkAlertShownToday(dateStr: string, alertKey: string): void {
  try {
    const set = getShownAlertKeysToday(dateStr);
    set.delete(alertKey);
    sessionStorage.setItem(getShownAlertsStorageKey(dateStr), JSON.stringify(Array.from(set)));
  } catch {
    // safe fallback
  }
}

/** Returns true if the user clicked "Skip today" for timetable alerts */
function isTimetableSkippedToday(dateStr: string): boolean {
  try {
    return sessionStorage.getItem(TIMETABLE_SKIP_TODAY_KEY) === dateStr;
  } catch {
    return false;
  }
}

/** Mark timetable alerts as skipped for today */
function skipTimetableToday(dateStr: string): void {
  try {
    sessionStorage.setItem(TIMETABLE_SKIP_TODAY_KEY, dateStr);
  } catch {
    // safe fallback
  }
}

/** Returns true if the current local time falls within quiet hours (using user timezone) */
function isQuietHours(quietStart: string | null, quietEnd: string | null, tz: string): boolean {
  if (!quietStart || !quietEnd) return false;
  try {
    const { totalMinutes: nowMins } = getLocalMinutes(tz);
    const [sh, sm] = quietStart.split(":").map(Number);
    const [eh, em] = quietEnd.split(":").map(Number);
    const startMins = sh * 60 + (sm || 0);
    const endMins = eh * 60 + (em || 0);
    if (startMins <= endMins) {
      return nowMins >= startMins && nowMins < endMins;
    }
    // Overnight quiet hours (e.g. 22:00 → 07:00)
    return nowMins >= startMins || nowMins < endMins;
  } catch {
    return false;
  }
}

/** Returns true if notifications are currently paused (pausedUntil is in the future) */
function isPaused(pausedUntil: string | null): boolean {
  if (!pausedUntil) return false;
  try {
    return new Date(pausedUntil) > new Date();
  } catch {
    return false;
  }
}

/**
 * Evaluates today's schedule every minute and returns the next
 * timetable alert that should be shown, or null if none.
 *
 * Rules:
 *  - Uses user's timezone for all time comparisons and date resolution
 *  - Respects preferences.proactiveEnabled, pausedUntil, quietHoursStart/End
 *  - Never shows the same message twice (stores set of shown keys in sessionStorage)
 *  - "Skip today" suppresses all timetable alerts for the rest of the day
 *  - Don't invent times that aren't in the timetable (item.start is strictly used)
 *  - Triggers:
 *      • "get-ready": ~30 min before first item ("Time to get up and get ready, you need to leave in 30 minutes")
 *      • "pre-<start>": 15 min before each upcoming non-break item ("Your 10:00 class starts in 15 minutes")
 *      • "eod": end-of-day wrap-up when all items are past
 */
function evaluateTimetableAlert(
  schedule: ScheduleSummary | null,
  dateStr: string,
  tz: string
): TimetableAlert | null {
  if (!schedule || schedule.items.length === 0) return null;
  if (isTimetableSkippedToday(dateStr)) return null;

  const { hours, totalMinutes } = getLocalMinutes(tz);

  // Sort items by start time
  const items = [...schedule.items].sort((a, b) => {
    const [ah, am] = a.start.split(":").map(Number);
    const [bh, bm] = b.start.split(":").map(Number);
    return ah * 60 + (am || 0) - (bh * 60 + (bm || 0));
  });

  // Filter active non-break and non-free items
  const activeItems = items.filter((it) => it.type !== "break" && it.type !== "free" && it.start && it.end);
  if (activeItems.length === 0) return null;

  // ── Trigger 1: ~30-min pre-first-item "get ready" ─────────────────────────
  const firstItem = activeItems[0];
  const [fh, fm] = firstItem.start.split(":").map(Number);
  const firstStartMins = fh * 60 + (fm || 0);
  const minsUntilFirst = firstStartMins - totalMinutes;

  if (minsUntilFirst > 15 && minsUntilFirst <= 35) {
    const key = `get-ready-${firstItem.start}`;
    if (!isAlertShownToday(dateStr, key)) {
      const timePhrase = minsUntilFirst === 30 ? "30 minutes" : `${minsUntilFirst} minutes`;
      return {
        key,
        message: `Time to get up and get ready, you need to leave in ${timePhrase}`,
        subText: firstItem.title
          ? `Upcoming at ${firstItem.start}: "${firstItem.title}". Don't forget your essentials! 🎒`
          : "Don't forget your essentials — you've got this! 💪",
        pose: "wave",
      };
    }
  }

  // ── Trigger 2: 15-min pre-each-item reminder ──────────────────────────────
  for (const item of activeItems) {
    const [sh, sm] = item.start.split(":").map(Number);
    const itemStartMins = sh * 60 + (sm || 0);
    const diff = itemStartMins - totalMinutes;

    if (diff > 0 && diff <= 15) {
      const key = `pre-${item.start}`;
      if (!isAlertShownToday(dateStr, key)) {
        const timePhrase = diff === 15 ? "15 minutes" : `${diff} minute${diff === 1 ? "" : "s"}`;
        const itemLabel = item.title ? item.title : "activity";
        return {
          key,
          message: `Your ${item.start} ${itemLabel} starts in ${timePhrase}`,
          subText: "Head over soon and take your time getting settled! ✨",
          pose: "curious",
        };
      }
    }
  }

  // ── Trigger 3: End-of-day wrap-up ─────────────────────────────────────────
  const lastItem = activeItems[activeItems.length - 1];
  const [lh, lm] = lastItem.end.split(":").map(Number);
  const lastEndMins = lh * 60 + (lm || 0);

  if (totalMinutes >= lastEndMins && hours >= 17) {
    const key = `eod-${dateStr}`;
    if (!isAlertShownToday(dateStr, key)) {
      return {
        key,
        message: `That's a wrap for today! You finished all ${activeItems.length} activities. How did it go?`,
        subText: "Take a moment to rest — you showed up and that always counts. ✨",
        pose: "celebrate",
      };
    }
  }

  return null;
}

function mapGuidePoseToCompanionPose(pose: string): CompanionPose {
  switch (pose) {
    case "celebrate":
      return "celebrate";
    case "ponder":
      return "think";
    case "point":
      return "turn";
    case "greet":
      return "wave";
    case "walk":
      return "walk";
    case "concerned":
      return "concerned";
    case "sleepy":
      return "sleepy";
    case "curious":
      return "curious";
    case "happy":
      return "happy";
    case "idle":
    default:
      return "idle";
  }
}

function pickGreetingVariant(
  options: Array<{ message: string; subText?: string; pose: CompanionPose }>
): { message: string; subText?: string; pose: CompanionPose } {
  if (options.length === 1) return options[0];
  let lastText = "";
  try {
    lastText = localStorage.getItem(LAST_GREETING_TEXT_KEY) || "";
  } catch {
    // fallback
  }
  const filtered = options.filter((o) => o.message !== lastText);
  const pool = filtered.length > 0 ? filtered : options;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  try {
    localStorage.setItem(LAST_GREETING_TEXT_KEY, selected.message);
  } catch {
    // fallback
  }
  return selected;
}

/** Serialisable break session state stored in sessionStorage */
interface BreakSessionState {
  id: string;
  endsAt: string;          // ISO
  extensionUsed: boolean;
  extensionEndsAt: string | null;
  nextTaskTitle: string | null;
  durationMinutes: number;
}

interface FloatingNudgeState {
  id: string;
  trigger: string;
  message: string;
  strictness?: string;
  metadata?: Record<string, unknown>;
}

interface FloatingBubbleMessage {
  id: string;
  role: "nikki" | "user";
  content: string;
}

export function NikkiProactivePresence() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { firebaseUser } = useAuth();
  const { profile } = useProfile();
  const { preferences, activeCheckIn, respondToCheckIn, dismissCheckIn } = useNotifications();
  const companionName = profile?.companionName || "Nikki";
  const userName = profile?.displayName || "moon";

  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isInteractiveOpen, setIsInteractiveOpen] = useState(false);
  const [openingGreeting, setOpeningGreeting] = useState<OpeningGreeting | null>(null);
  const [activeSignal, setActiveSignal] = useState<{ state: string; pose: CompanionPose } | null>(null);
  const [goodbyeMessage, setGoodbyeMessage] = useState<string | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPositionLoaded, setIsPositionLoaded] = useState(false);
  const isDraggingRef = useRef(false);

  // ── Timetable alert engine ─────────────────────────────────────────────────
  const [todaySchedule, setTodaySchedule] = useState<ScheduleSummary | null>(null);
  const [timetableAlert, setTimetableAlert] = useState<TimetableAlert | null>(null);
  /** tracks which alert key is currently snoozed (suppressed until snoozeUntil ms) */
  const snoozeRef = useRef<{ key: string; until: number } | null>(null);

  // ── Break mode engine ──────────────────────────────────────────────────────
  const [activeBreak, setActiveBreak] = useState<BreakSessionState | null>(null);
  const [breakEndAlert, setBreakEndAlert] = useState<{
    message: string;
    nextTaskTitle: string | null;
    extensionUsed: boolean;
  } | null>(null);
  const [breakPickerOpen, setBreakPickerOpen] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState("");

  // ── Conversational Presence & Nikki Nudge State ───────────────────────────
  const [activeNudge, setActiveNudge] = useState<FloatingNudgeState | null>(null);
  const [isConversationalOpen, setIsConversationalOpen] = useState(false);
  const [bubbleConversation, setBubbleConversation] = useState<FloatingBubbleMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Restore minimized state from this browser session
  useEffect(() => {
    try {
      if (sessionStorage.getItem(MINIMIZED_STORAGE_KEY) === "true") {
        setIsMinimized(true);
      }
    } catch {
      // safe fallback
    }
  }, []);

  // ── Restore active break from sessionStorage then server on mount ──────────
  useEffect(() => {
    if (!firebaseUser) return;
    // 1. Fast restore from sessionStorage so UI doesn't flicker
    try {
      const raw = sessionStorage.getItem(BREAK_SESSION_KEY);
      if (raw) {
        const parsed: BreakSessionState = JSON.parse(raw);
        const endsAtMs = new Date(parsed.extensionEndsAt ?? parsed.endsAt).getTime();
        if (endsAtMs > Date.now()) {
          setActiveBreak(parsed);
        } else {
          sessionStorage.removeItem(BREAK_SESSION_KEY);
        }
      }
    } catch {
      // safe fallback
    }
    // 2. Authoritative fetch from server (handles cross-tab / push-extended sessions)
    authFetch("/api/schedule/break")
      .then((res) => res.json())
      .then((env) => {
        const data = env?.data;
        if (data) {
          const session: BreakSessionState = {
            id: data.id,
            endsAt: data.endsAt,
            extensionUsed: data.extensionUsed,
            extensionEndsAt: data.extensionEndsAt ?? null,
            nextTaskTitle: data.nextTaskTitle ?? null,
            durationMinutes: data.durationMinutes,
          };
          try { sessionStorage.setItem(BREAK_SESSION_KEY, JSON.stringify(session)); } catch {}
          setActiveBreak(session);
        } else {
          // Server says no active break — clear local state
          try { sessionStorage.removeItem(BREAK_SESSION_KEY); } catch {}
          setActiveBreak(null);
        }
      })
      .catch(() => { /* best-effort */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  // ── Heartbeat: updates lastSeenAt on server while app is open ──────────────
  useEffect(() => {
    if (!firebaseUser) return;
    const sendHeartbeat = () => {
      authFetch("/api/nikki/heartbeat", { method: "POST" }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(interval);
  }, [firebaseUser]);

  // ── Nudge Poller: fetch pending nudges when app opens and every 60s ────────
  const fetchPendingNudge = useCallback(async () => {
    if (!firebaseUser) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const res = await authFetch("/api/nikki/nudge");
      if (!res.ok) return;
      const env = await res.json();
      if (env?.data) {
        setActiveNudge(env.data);
        setBubbleConversation([
          { id: env.data.id, role: "nikki", content: env.data.message },
        ]);
        setIsConversationalOpen(true);
        setIsMinimized(false);
      }
    } catch {
      /* best-effort */
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    fetchPendingNudge();

    // Check URL param ?openNikki=... on mount (e.g. from push click)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const openNikkiParam = params.get("openNikki");
      if (openNikkiParam) {
        setIsConversationalOpen(true);
        setIsMinimized(false);
        fetchPendingNudge();
        try {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, "", cleanUrl);
        } catch {}
      }
    }

    const interval = setInterval(fetchPendingNudge, 60_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchPendingNudge();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [firebaseUser, fetchPendingNudge]);

  // ── Load today's schedule once on mount or timezone change ─────────────────
  const fetchTodaySchedule = useCallback(() => {
    if (!firebaseUser) return;
    const tz = getUserTimezone(profile?.timezone);
    const dateStr = getTodayDateStr(tz);
    authFetch(`/api/schedule/${dateStr}`)
      .then((res) => parseApiResponse<ScheduleSummary | null>(res).then((env) => {
        if (res.ok) setTodaySchedule(env.data ?? null);
      }))
      .catch(() => { /* best-effort */ });
  }, [firebaseUser, profile?.timezone]);

  useEffect(() => {
    fetchTodaySchedule();
  }, [fetchTodaySchedule]);

  // Sync today's schedule when chat creates/updates a schedule
  useEffect(() => {
    const handleScheduleChange = () => fetchTodaySchedule();
    window.addEventListener("companion:schedule-change", handleScheduleChange);
    return () => window.removeEventListener("companion:schedule-change", handleScheduleChange);
  }, [fetchTodaySchedule]);

  // ── Minute-tick: timetable alerts + break-end detection ──────────────────
  useEffect(() => {
    if (!firebaseUser) return;

    function tick() {
      const now = Date.now();

      // ── Break-end check (runs even during quiet hours for in-app bubble) ──
      setActiveBreak((currentBreak) => {
        if (!currentBreak) return currentBreak;
        const effectiveEnd = new Date(currentBreak.extensionEndsAt ?? currentBreak.endsAt).getTime();
        if (now >= effectiveEnd) {
          // Break has ended — show in-app bubble
          setBreakEndAlert({
            message: currentBreak.nextTaskTitle
              ? `Break's over! Ready to get back to "${currentBreak.nextTaskTitle}"? 💪`
              : `Break time's up! Take it at your own pace — I'm here whenever you're ready ✨`,
            nextTaskTitle: currentBreak.nextTaskTitle,
            extensionUsed: currentBreak.extensionUsed,
          });
          try { sessionStorage.removeItem(BREAK_SESSION_KEY); } catch {}
          return null; // clear active break
        }
        return currentBreak;
      });

      // ── Timetable alert gates ──────────────────────────────────────────────
      // Gate 1: proactive must be enabled
      if (preferences?.proactiveEnabled === false) return;
      // Gate 2: notifications must not be paused
      if (isPaused(preferences?.pausedUntil ?? null)) return;
      // Gate 3: quiet hours
      const tz = getUserTimezone(profile?.timezone);
      if (isQuietHours(preferences?.quietHoursStart ?? null, preferences?.quietHoursEnd ?? null, tz)) return;
      // Gate 4: don't interrupt while user is typing
      if (document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
         document.activeElement.tagName === "TEXTAREA" ||
         (document.activeElement as HTMLElement).isContentEditable)) return;
      // Gate 5: suppress timetable alerts while break is active
      if (activeBreak) return;

      const dateStr = getTodayDateStr(tz);
      if (!todaySchedule) {
        fetchTodaySchedule();
        return;
      }
      if (snoozeRef.current) {
        if (now < snoozeRef.current.until) {
          return;
        }
        snoozeRef.current = null;
      }
      const alert = evaluateTimetableAlert(todaySchedule, dateStr, tz);
      if (!alert) return;

      markAlertShownToday(dateStr, alert.key);
      setTimetableAlert(alert);
    }

    // Fire immediately on mount/schedule-load, then every 60 s
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [firebaseUser, todaySchedule, preferences, profile?.timezone, fetchTodaySchedule, activeBreak]);

  const handleRestoreFromDot = useCallback(() => {
    setIsMinimized(false);
    try {
      sessionStorage.removeItem(MINIMIZED_STORAGE_KEY);
    } catch {
      // safe fallback
    }
  }, []);

  const handleByeNikki = useCallback(() => {
    setIsInteractiveOpen(false);
    setActiveSignal({ state: "leaving", pose: "wave" });

    const farewellLines = [
      `Bye for now, ${userName}! 👋 Take care and see you soon!`,
      `See you later, ${userName}! I'll be resting right here. Tap my dot whenever you need me! ✨`,
      `Have a wonderful time, ${userName}! Wave to me anytime you want me back! 👋`,
    ];
    const line = farewellLines[Math.floor(Math.random() * farewellLines.length)];
    setGoodbyeMessage(line);

    try {
      localStorage.setItem(
        "companion:user-state",
        JSON.stringify({ state: "leaving", timestamp: Date.now() })
      );
    } catch {
      // safe fallback
    }

    // Wave and speak goodbye, then minimise to a small dot
    setTimeout(() => {
      setGoodbyeMessage(null);
      setIsMinimized(true);
      setActiveSignal(null);
      try {
        sessionStorage.setItem(MINIMIZED_STORAGE_KEY, "true");
      } catch {
        // safe fallback
      }
    }, 2200);
  }, [userName]);

  // ── Break session helpers ──────────────────────────────────────────────────
  /** Returns the title of the next upcoming timetable item (for break context) */
  const getNextTaskTitle = useCallback((): string | null => {
    if (!todaySchedule) return null;
    const tz = getUserTimezone(profile?.timezone);
    const { totalMinutes } = getLocalMinutes(tz);
    const upcoming = [...todaySchedule.items]
      .filter((it) => it.type !== "break" && it.type !== "free" && it.start)
      .sort((a, b) => {
        const [ah, am] = a.start.split(":").map(Number);
        const [bh, bm] = b.start.split(":").map(Number);
        return ah * 60 + (am || 0) - (bh * 60 + (bm || 0));
      })
      .find((it) => {
        const [h, m] = it.start.split(":").map(Number);
        return h * 60 + (m || 0) > totalMinutes;
      });
    return upcoming?.title ?? null;
  }, [todaySchedule, profile?.timezone]);

  const handleStartBreak = useCallback(async (minutes: number) => {
    setBreakPickerOpen(false);
    setIsInteractiveOpen(false);
    if (!firebaseUser) return;
    const nextTaskTitle = getNextTaskTitle();
    try {
      const res = await authFetch("/api/schedule/break", {
        method: "POST",
        body: JSON.stringify({ durationMinutes: minutes, nextTaskTitle }),
      });
      const env = await res.json();
      if (env?.data) {
        const session: BreakSessionState = {
          id: env.data.id,
          endsAt: env.data.endsAt,
          extensionUsed: env.data.extensionUsed,
          extensionEndsAt: env.data.extensionEndsAt ?? null,
          nextTaskTitle: env.data.nextTaskTitle ?? null,
          durationMinutes: env.data.durationMinutes,
        };
        try { sessionStorage.setItem(BREAK_SESSION_KEY, JSON.stringify(session)); } catch {}
        setActiveBreak(session);
        setBreakEndAlert(null);
        setTimetableAlert(null);
        setOpeningGreeting(null);
      }
    } catch {
      /* best-effort */
    }
  }, [firebaseUser, getNextTaskTitle]);

  const handleExtendBreak = useCallback(async () => {
    setBreakEndAlert(null);
    if (!firebaseUser) return;
    try {
      const res = await authFetch("/api/schedule/break/extend", { method: "POST" });
      const env = await res.json();
      if (env?.data) {
        const session: BreakSessionState = {
          id: env.data.id,
          endsAt: env.data.endsAt,
          extensionUsed: env.data.extensionUsed,
          extensionEndsAt: env.data.extensionEndsAt ?? null,
          nextTaskTitle: env.data.nextTaskTitle ?? null,
          durationMinutes: env.data.durationMinutes,
        };
        try { sessionStorage.setItem(BREAK_SESSION_KEY, JSON.stringify(session)); } catch {}
        setActiveBreak(session);
      }
    } catch {
      /* best-effort */
    }
  }, [firebaseUser]);

  const handleCancelBreak = useCallback(async () => {
    setBreakEndAlert(null);
    setActiveBreak(null);
    try { sessionStorage.removeItem(BREAK_SESSION_KEY); } catch {}
    if (!firebaseUser) return;
    authFetch("/api/schedule/break", { method: "DELETE" }).catch(() => {});
  }, [firebaseUser]);

  // ── Conversational Presence Handlers ───────────────────────────────────────
  const quickReplyChips = useMemo(() => {
    const trigger = activeNudge?.trigger;
    if (trigger === "timetable_unstarted") {
      return ["Starting now 💪", "Move 15m", "Skip today"];
    }
    if (trigger === "morning_plan") {
      return ["Got my water! 💧", "Ready to plan", "Taking it slow"];
    }
    if (trigger === "no_timetable") {
      return ["Let's make a plan", "Free day today"];
    }
    if (trigger === "mood_followup") {
      return ["Feeling a bit better", "Still overwhelmed", "Just resting"];
    }
    if (trigger === "late_night") {
      return ["Heading to bed 🌙", "Just 5 more minutes"];
    }
    if (trigger === "long_session") {
      return ["Taking a break", "Finishing one thing"];
    }
    if (trigger === "task_overdue") {
      return ["Starting a tiny piece", "Move deadline"];
    }
    if (trigger === "long_silence") {
      return ["Doing well!", "Missed you!"];
    }
    return ["I'm doing good", "Help me plan", `Bye ${companionName}`];
  }, [activeNudge?.trigger, companionName]);

  const toggleVoice = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch {}
      setIsListening(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onresult = (e: any) => {
        const transcript = Array.from(e.results)
          .map((r: any) => r[0]?.transcript || "")
          .join("");
        setInputText(transcript);
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  const handleSendReply = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend ?? inputText).trim();
      if (!text || isSubmitting) return;

      setInputText("");
      setIsSubmitting(true);

      // Handle user saying goodbye naturally
      if (/^(bye|see you|goodbye)\b/i.test(text)) {
        setIsConversationalOpen(false);
        handleByeNikki();
        setIsSubmitting(false);
        return;
      }

      // Handle user requesting a break naturally
      if (/\b(take a break|taking a break|need a break)\b/i.test(text)) {
        setBreakPickerOpen(true);
        setIsConversationalOpen(false);
        setIsSubmitting(false);
        return;
      }

      const userMsgId = `user_${Date.now()}`;
      setBubbleConversation((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: text },
      ]);

      try {
        const tz = getUserTimezone(profile?.timezone);
        const res = await authFetch("/api/nikki/nudge/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nudgeId: activeNudge?.id,
            message: text,
            timezone: tz,
          }),
        });

        const env = await res.json();
        if (env?.data?.reply) {
          setBubbleConversation((prev) => [
            ...prev,
            { id: `nikki_${Date.now()}`, role: "nikki", content: env.data.reply },
          ]);

          // Talking animation reaction
          setActiveSignal({ state: "talking", pose: "happy" });
          setTimeout(() => setActiveSignal(null), 3000);

          // If timetable was modified, emit event so timetable UI syncs
          if (env.data.schedule || env.data.intent === "timetable_delete") {
            window.dispatchEvent(new CustomEvent("companion:schedule-change"));
          }
        }
      } catch {
        setBubbleConversation((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "nikki",
            content: "I'm right here with you! Let me know if you need anything else.",
          },
        ]);
      } finally {
        setIsSubmitting(false);
      }
    },
    [inputText, isSubmitting, activeNudge?.id, profile?.timezone, handleByeNikki]
  );

  const handleDismissBubble = useCallback(async () => {
    setIsConversationalOpen(false);
    if (activeNudge?.id) {
      authFetch("/api/nikki/nudge/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nudgeId: activeNudge.id }),
      }).catch(() => {});
      setActiveNudge(null);
    }
  }, [activeNudge?.id]);

  const handleMuteForNow = useCallback(async () => {
    setIsConversationalOpen(false);
    if (activeNudge?.id) {
      setActiveNudge(null);
    }
    try {
      await authFetch("/api/nikki/nudge/mute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: 2 }),
      });
    } catch {}
  }, [activeNudge?.id]);

  // Listen to companion state change events triggered by chat intent interactions (goodbye, return, sleep, break)
  useEffect(() => {
    function handleStateChange(e: Event) {
      const customEvent = e as CustomEvent<{ state: string; pose: CompanionPose }>;
      if (customEvent.detail) {
        setActiveSignal(customEvent.detail);
      }
    }
    window.addEventListener("companion:state-change", handleStateChange);
    return () => window.removeEventListener("companion:state-change", handleStateChange);
  }, []);

  // 1. Load remembered position from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(POSITION_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            setPosition(parsed);
          }
        }
      } catch {
        // Fallback to default position
      }
      setIsPositionLoaded(true);
    }
  }, []);

  // 2. Monitor if user is typing in an input/textarea to avoid obstructing their view
  useEffect(() => {
    function handleFocus(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        setIsTyping(true);
      }
    }
    function handleBlur() {
      setIsTyping(false);
    }

    window.addEventListener("focusin", handleFocus);
    window.addEventListener("focusout", handleBlur);
    return () => {
      window.removeEventListener("focusin", handleFocus);
      window.removeEventListener("focusout", handleBlur);
    };
  }, []);

  // 3. Proactive Greeting Engine on Companion App Open / Login / Refresh / Return
  const evaluateOpeningGreeting = useCallback(async () => {
    if (!firebaseUser) return;
    if (typeof window === "undefined") return;

    // Respect Settings toggle for proactive check-ins (proactiveEnabled)
    if (preferences && preferences.proactiveEnabled === false) return;

    // Show opening greeting at most once per session
    try {
      if (sessionStorage.getItem(SESSION_GREETING_KEY) === "1") return;
      if (sessionStorage.getItem(DISMISSED_GREETING_KEY) === "true") return;
    } catch {
      // safe fallback
    }

    // Rule: Avoid interrupting an active conversation (if user chatted in the last 2 minutes)
    try {
      const lastChatTime = localStorage.getItem(LAST_CHAT_MESSAGE_KEY);
      if (lastChatTime) {
        const msSinceChat = Date.now() - parseInt(lastChatTime, 10);
        if (msSinceChat < 2 * 60 * 1000 && window.location.pathname === "/dashboard") {
          return;
        }
      }
    } catch {
      // safe fallback
    }

    const now = new Date();
    const localHour = now.getHours();
    const localMinutes = localHour * 60 + now.getMinutes();

    let todayDateStr = "";
    try {
      todayDateStr = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
    } catch {
      todayDateStr = now.toISOString().slice(0, 10);
    }

    // Check last interaction timestamp
    let lastVisitTimestamp = 0;
    try {
      const storedLast = localStorage.getItem(LAST_INTERACTION_KEY);
      if (storedLast) lastVisitTimestamp = parseInt(storedLast, 10);
    } catch {
      // safe fallback
    }

    // Check when greeting was last shown (avoid re-greeting on simple link clicks within 8 minutes)
    let lastGreetingShownTime = 0;
    try {
      const storedGTime = sessionStorage.getItem(LAST_GREETING_TIME_KEY);
      if (storedGTime) lastGreetingShownTime = parseInt(storedGTime, 10);
    } catch {
      // safe fallback
    }

    const minutesSinceLastVisit = lastVisitTimestamp > 0 ? (now.getTime() - lastVisitTimestamp) / (1000 * 60) : 999;
    const minutesSinceLastGreeting = lastGreetingShownTime > 0 ? (now.getTime() - lastGreetingShownTime) / (1000 * 60) : 999;

    // Update last interaction timestamp
    localStorage.setItem(LAST_INTERACTION_KEY, now.getTime().toString());

    // If a greeting was shown less than 8 minutes ago and user wasn't away for > 20 minutes, don't re-trigger
    if (minutesSinceLastGreeting < 8 && minutesSinceLastVisit < 20) {
      return;
    }

    // Fetch today's saved timetable from database
    let todaySchedule: ScheduleSummary | null = null;
    try {
      const schedRes = await authFetch(`/api/schedule/${todayDateStr}`);
      const schedEnv = await parseApiResponse<ScheduleSummary | null>(schedRes);
      if (schedRes.ok && schedEnv.data) {
        todaySchedule = schedEnv.data;
      }
    } catch {
      // Best-effort schedule fetch
    }

    // Analyze schedule items
    let collegeItem: { start: string; end: string; title: string } | null = null;
    let nextUpcomingItem: { start: string; end: string; title: string; diffMins: number } | null = null;
    let completedItemsCount = 0;
    let collegeFinishedRecently = false;

    if (todaySchedule?.items && todaySchedule.items.length > 0) {
      for (const item of todaySchedule.items) {
        const [sH, sM] = item.start.split(":").map(Number);
        const [eH, eM] = item.end.split(":").map(Number);
        const itemStartMins = sH * 60 + (sM || 0);
        const itemEndMins = eH * 60 + (eM || 0);
        const lower = item.title.toLowerCase();

        if (/college|class|lecture|uni|school/.test(lower)) {
          collegeItem = item;
          // Finished in the last 90 minutes
          const diffAfterEnd = localMinutes - itemEndMins;
          if (diffAfterEnd >= 0 && diffAfterEnd <= 90) {
            collegeFinishedRecently = true;
          }
        }

        if (itemEndMins < localMinutes) {
          completedItemsCount++;
        }

        const diff = itemStartMins - localMinutes;
        if (diff > 0 && (!nextUpcomingItem || diff < nextUpcomingItem.diffMins)) {
          nextUpcomingItem = { ...item, diffMins: diff };
        }
      }
    }

    // Generate contextual greeting
    let greeting: OpeningGreeting | null = null;

    // Check if user previously announced departure/sleep/break/college in chat
    let storedUserState: { state: string; timestamp: number } | null = null;
    try {
      const rawState = localStorage.getItem("companion:user-state");
      if (rawState) {
        storedUserState = JSON.parse(rawState);
      }
    } catch {
      // safe fallback
    }

    if (storedUserState && storedUserState.state) {
      if (storedUserState.state === "college" || collegeFinishedRecently) {
        const picked = pickGreetingVariant([
          {
            message: "You're backkk! How did college go today? Time to unwind a bit.",
            subText: "Have some water, take a rest, and tell me how everything went.",
            pose: "celebrate",
          },
          {
            message: "Welcome back from college! You did great today.",
            subText: "Kick off your shoes and relax. I'm right here whenever you need me.",
            pose: "happy",
          },
        ]);
        greeting = {
          id: `return_col_${Date.now()}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: `Tell ${companionName}`, action: "talk", variant: "primary" },
            { label: "View Schedule", action: "accept", payload: "/plan?tab=schedule", variant: "secondary" },
          ],
        };
        try { localStorage.removeItem("companion:user-state"); } catch {}
      } else if (storedUserState.state === "sleeping" && localHour >= 5 && localHour < 14) {
        const picked = pickGreetingVariant([
          {
            message: "Good morninggg! ☀️ Hope you slept peacefully! Ready for today?",
            subText: "Let's take things one step at a time. What's first on your mind?",
            pose: "happy",
          },
          {
            message: "Morning! Did you sleep well? Today is ready for you.",
            subText: "Shall we check your timetable or ease into the day gently?",
            pose: "wave",
          },
        ]);
        greeting = {
          id: `return_sleep_${Date.now()}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: `Talk to ${companionName}`, action: "talk", variant: "primary" },
            { label: "Plan Day", action: "accept", payload: "/plan?tab=schedule", variant: "secondary" },
          ],
        };
        try { localStorage.removeItem("companion:user-state"); } catch {}
      } else if (storedUserState.state === "break") {
        const picked = pickGreetingVariant([
          {
            message: "Welcome back from your break! Feeling refreshed?",
            subText: "Ready to pick things back up whenever you are.",
            pose: "happy",
          },
          {
            message: "You're back! Hope you had a nice breather.",
            subText: "Let's ease back into your focus or schedule.",
            pose: "curious",
          },
        ]);
        greeting = {
          id: `return_break_${Date.now()}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: `Chat with ${companionName}`, action: "talk", variant: "primary" },
            { label: "Continue", action: "dismiss", variant: "ghost" },
          ],
        };
        try { localStorage.removeItem("companion:user-state"); } catch {}
      }
    }

    // SCENARIO 0: First Login / New arrival (never visited before)
    if (!greeting && (minutesSinceLastVisit === 999 || lastVisitTimestamp === 0)) {
      const picked = pickGreetingVariant([
        {
          message: `Welcome to Companion, ${userName}! 🌟 I'm ${companionName}. I'm right here whenever you need me!`,
          subText: "We can plan your day, run focus sessions, or just chat whenever you feel like.",
          pose: "wave",
        },
        {
          message: `Heyyy ${userName}! So happy you're here. Let's make today a calm and productive one!`,
          subText: `I'm ${companionName}, your personal companion. Ready whenever you are!`,
          pose: "happy",
        },
      ]);

      greeting = {
        id: `first_login_${Date.now()}`,
        message: picked.message,
        subText: picked.subText,
        pose: picked.pose,
        actions: [
          { label: `Talk to ${companionName}`, action: "talk", variant: "primary" },
          { label: "Plan Day", action: "accept", payload: "/plan", variant: "secondary" },
        ],
      };
    }
    // SCENARIO 1: Returning after absence (away for > 25 minutes)
    else if (minutesSinceLastVisit > 25 && minutesSinceLastVisit <= 12 * 60) {
      const picked = pickGreetingVariant([
        {
          message: "There you are! How have you been? Everything going okay?",
          subText: "I'm right here with you. Take things one step at a time.",
          pose: "happy",
        },
        {
          message: "You're backkk! How's your day going?",
          subText: "Good to see you again. Ready whenever you are!",
          pose: "curious",
        },
        {
          message: "Welcome back! Hope everything has been going smoothly.",
          subText: "Let's take things steady and ease into whatever's next.",
          pose: "wave",
        },
      ]);

      greeting = {
        id: `return_${Date.now()}`,
        message: picked.message,
        subText: picked.subText,
        pose: picked.pose,
        actions: [
          { label: `Talk to ${companionName}`, action: "talk", variant: "primary" },
          { label: "Dismiss", action: "dismiss", variant: "ghost" },
        ],
      };
    }
    // SCENARIO 2: Morning greeting (05:00 – 11:59)
    else if (localHour >= 5 && localHour < 12) {
      if (collegeItem) {
        const [cH, cM] = collegeItem.start.split(":").map(Number);
        const colStartMins = cH * 60 + (cM || 0);
        const diffBeforeCol = colStartMins - localMinutes;

        if (diffBeforeCol > 0 && diffBeforeCol <= 60) {
          const picked = pickGreetingVariant([
            {
              message: `College starts soon at ${collegeItem.start}. Have you had breakfast?`,
              subText: "Don't forget your bag, water, and essentials! Let's get you ready.",
              pose: "wave",
            },
            {
              message: `${userName}! Your ${collegeItem.title.toLowerCase()} starts at ${collegeItem.start}. It's time to get ready!`,
              subText: "Grab a bite to eat first so you have steady energy today.",
              pose: "happy",
            },
          ]);

          greeting = {
            id: `morning_col_${todayDateStr}`,
            message: picked.message,
            subText: picked.subText,
            pose: picked.pose,
            actions: [
              { label: "View Timetable", action: "accept", payload: "/plan?tab=schedule", variant: "primary" },
              { label: `Talk to ${companionName}`, action: "talk", variant: "secondary" },
            ],
          };
        } else {
          const picked = pickGreetingVariant([
            {
              message: "Heyyy! You've got college today. Have you had breakfast?",
              subText: `Scheduled for ${collegeItem.start}–${collegeItem.end}. Let's make today smooth!`,
              pose: "wave",
            },
            {
              message: `Good morning! You've got ${collegeItem.title.toLowerCase()} scheduled for ${collegeItem.start}.`,
              subText: "Ready to make today a good one? Take your time getting ready.",
              pose: "happy",
            },
          ]);

          greeting = {
            id: `morning_col_early_${todayDateStr}`,
            message: picked.message,
            subText: picked.subText,
            pose: picked.pose,
            actions: [
              { label: "View Schedule", action: "accept", payload: "/plan?tab=schedule", variant: "primary" },
              { label: `Talk to ${companionName}`, action: "talk", variant: "secondary" },
            ],
          };
        }
      } else if (todaySchedule && todaySchedule.items.length > 0) {
        const picked = pickGreetingVariant([
          {
            message: "GOOD MORNINGGG! ☀️ You're up! Ready to make today a good one?",
            subText: `You have ${todaySchedule.items.length} activities planned on your timetable.`,
            pose: "happy",
          },
          {
            message: "Good morning! Did you sleep well? Today is ready for you.",
            subText: `You have ${todaySchedule.items.length} scheduled items. Let's take them one step at a time.`,
            pose: "wave",
          },
        ]);

        greeting = {
          id: `morning_plan_${todayDateStr}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: "View Today's Plan", action: "accept", payload: "/plan?tab=schedule", variant: "primary" },
            { label: `Talk to ${companionName}`, action: "talk", variant: "secondary" },
          ],
        };
      } else {
        const picked = pickGreetingVariant([
          {
            message: `Good morning, ${userName}! Ready to start the day?`,
            subText: "Shall we plan your day together so everything feels calm?",
            pose: "wave",
          },
          {
            message: "Good morning! Did you sleep well?",
            subText: "Shall we plan your day together so everything feels calm?",
            pose: "wave",
          },
          {
            message: "GOOD MORNINGGG! ☀️ You're up! Ready to make today a good one?",
            subText: `I'm right here if you want to set up your schedule or just chat.`,
            pose: "happy",
          },
          {
            message: "Rise and shine, moon! 🌅 What's the main thing on your mind for today?",
            subText: "Small steady steps. We'll do this together.",
            pose: "curious",
          },
        ]);

        greeting = {
          id: `morning_general_${todayDateStr}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: `Plan Day with ${companionName}`, action: "talk", variant: "primary" },
            { label: "I'm Ready!", action: "dismiss", variant: "ghost" },
          ],
        };
      }
    }
    // SCENARIO 3: Afternoon greeting (12:00 – 16:59)
    else if (localHour >= 12 && localHour < 17) {
      if (collegeFinishedRecently) {
        const picked = pickGreetingVariant([
          {
            message: "Welcome back! You're done with college for today. How was your day?",
            subText: "Kick off your shoes and take a nice breather.",
            pose: "celebrate",
          },
          {
            message: "You're back from college! How did everything go today?",
            subText: "Time to unwind a bit. Have some water and relax!",
            pose: "happy",
          },
        ]);

        greeting = {
          id: `afternoon_col_done_${todayDateStr}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: `Tell ${companionName}`, action: "talk", variant: "primary" },
            { label: "View Timetable", action: "accept", payload: "/plan?tab=schedule", variant: "secondary" },
          ],
        };
      } else if (nextUpcomingItem && nextUpcomingItem.diffMins <= 30) {
        greeting = {
          id: `afternoon_up_${nextUpcomingItem.start}`,
          message: `Heyyy! You have ${nextUpcomingItem.diffMins} minutes before your next activity: "${nextUpcomingItem.title}".`,
          subText: "Grab some water and take a quick stretch before you begin.",
          pose: "curious",
          actions: [
            { label: "View Timetable", action: "accept", payload: "/plan?tab=schedule", variant: "primary" },
            { label: `Talk to ${companionName}`, action: "talk", variant: "secondary" },
          ],
        };
      } else if (completedItemsCount > 0) {
        const picked = pickGreetingVariant([
          {
            message: `Afternoon check-in! You've already completed ${completedItemsCount} activities today! ✨`,
            subText: "Remember to take short breathers so you don't burn out.",
            pose: "happy",
          },
          {
            message: "Hey there! How is your afternoon going? Remember to take water breaks! 💧",
            subText: `You've checked off ${completedItemsCount} items already. Steady pace wins the day!`,
            pose: "curious",
          },
        ]);

        greeting = {
          id: `afternoon_completed_${todayDateStr}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: `Chat with ${companionName}`, action: "talk", variant: "primary" },
            { label: "View Timetable", action: "accept", payload: "/plan?tab=schedule", variant: "secondary" },
          ],
        };
      } else {
        const picked = pickGreetingVariant([
          {
            message: "Hey there! How is your afternoon going? Remember to take water breaks! 💧",
            subText: "Steady pace wins the day. I'm right here if you need anything.",
            pose: "curious",
          },
          {
            message: "Hope your day is flowing nicely, moon! Need to plan or focus on anything?",
            subText: "Take things at your own rhythm.",
            pose: "happy",
          },
        ]);

        greeting = {
          id: `afternoon_general_${todayDateStr}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: `Chat with ${companionName}`, action: "talk", variant: "primary" },
            { label: "Dismiss", action: "dismiss", variant: "ghost" },
          ],
        };
      }
    }
    // SCENARIO 4: Evening greeting (17:00 – 21:59)
    else if (localHour >= 17 && localHour < 22) {
      if (collegeItem) {
        const picked = pickGreetingVariant([
          {
            message: "Welcome back! How was your day at college?",
            subText: "Have some water, take a rest, and tell me how everything went.",
            pose: "celebrate",
          },
          {
            message: "You've had a full day with college. Shall we slow things down?",
            subText: "Rest is just as important as working hard. Take it easy!",
            pose: "think",
          },
        ]);

        greeting = {
          id: `evening_col_${todayDateStr}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: `Tell ${companionName}`, action: "talk", variant: "primary" },
            { label: "View Schedule", action: "accept", payload: "/plan?tab=schedule", variant: "secondary" },
          ],
        };
      } else {
        const picked = pickGreetingVariant([
          {
            message: "You've had a long day. Shall we slow things down and reflect a bit?",
            subText: "Whatever happened, you showed up and tried. That always counts.",
            pose: "think",
          },
          {
            message: "Good eveninggg! How did today turn out?",
            subText: "I'm right here if you want to recap or plan tomorrow.",
            pose: "happy",
          },
        ]);

        greeting = {
          id: `evening_gen_${todayDateStr}`,
          message: picked.message,
          subText: picked.subText,
          pose: picked.pose,
          actions: [
            { label: `Reflect with ${companionName}`, action: "talk", variant: "primary" },
            { label: "Check Tomorrow", action: "accept", payload: "/plan?tab=schedule", variant: "secondary" },
          ],
        };
      }
    }
    // SCENARIO 5: Late Night greeting (22:00 – 04:59)
    else {
      const picked = pickGreetingVariant([
        {
          message: "Still awake? Hehe. Make sure you don't push yourself too late. Sleep is medicine, moon. 🌙",
          subText: "Rest is when your brain integrates everything you learned today.",
          pose: "sleepy",
        },
        {
          message: "Burning the midnight oil? Remember to get proper rest tonight!",
          subText: "Don't stress over what didn't get done today. Tomorrow is a fresh start.",
          pose: "sleepy",
        },
      ]);

      greeting = {
        id: `night_${todayDateStr}`,
        message: picked.message,
        subText: picked.subText,
        pose: picked.pose,
        actions: [
          { label: `Talk to ${companionName}`, action: "talk", variant: "primary" },
          { label: `Goodnight ${companionName}`, action: "dismiss", variant: "ghost" },
        ],
      };
    }

    if (greeting) {
      try {
        sessionStorage.setItem(SESSION_GREETING_KEY, "1");
        sessionStorage.setItem(LAST_GREETING_TIME_KEY, now.getTime().toString());
      } catch {
        // safe fallback
      }
      setOpeningGreeting(greeting);
    }
  }, [firebaseUser, companionName, userName, preferences]);

  useEffect(() => {
    evaluateOpeningGreeting();
  }, [evaluateOpeningGreeting]);

  // Auto-dismiss opening greeting after 30 seconds of inactivity so it never clutters the UI
  useEffect(() => {
    if (!openingGreeting) return;
    const timer = setTimeout(() => {
      setOpeningGreeting(null);
    }, 30000);
    return () => clearTimeout(timer);
  }, [openingGreeting]);

  // Listen for tab focus / visibility return (e.g. user returns after being away)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        try {
          const storedLast = localStorage.getItem(LAST_INTERACTION_KEY);
          const lastTime = storedLast ? parseInt(storedLast, 10) : 0;
          const minutesAway = (Date.now() - lastTime) / (1000 * 60);
          if (minutesAway > 25) {
            evaluateOpeningGreeting();
          }
        } catch {
          // safe fallback
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [evaluateOpeningGreeting]);

  const floatingMode = preferences?.floatingPresence ?? "always";
  if (floatingMode === "off") {
    return null;
  }

  // Restore button if user temporarily minimized/hidden her
  if (isDismissed) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsDismissed(false);
          setIsMinimized(false);
        }}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-slate-900/90 px-3 py-1.5 text-xs text-cyan-300 shadow-xl backdrop-blur-md hover:border-cyan-400 transition-all"
        title="Summon Nikki"
      >
        <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        <span>Nikki</span>
      </button>
    );
  }

  // Derive pose based on active check-in, opening greeting, or time of day
  const currentHour = new Date().getHours();
  const isLateNight = currentHour >= 23 || currentHour < 5;

  let companionPose: CompanionPose = "idle";
  if (activeSignal?.pose) {
    companionPose = activeSignal.pose;
  } else if (activeCheckIn) {
    companionPose = mapGuidePoseToCompanionPose(activeCheckIn.characterPose);
  } else if (breakEndAlert) {
    companionPose = "wave";
  } else if (activeBreak) {
    companionPose = "sleepy"; // Nikki rests during your break
  } else if (timetableAlert) {
    companionPose = timetableAlert.pose;
  } else if (openingGreeting) {
    companionPose = openingGreeting.pose;
  } else if (isInteractiveOpen) {
    companionPose = "wave";
  } else if (isLateNight) {
    companionPose = "sleepy";
  } else if (currentHour >= 6 && currentHour < 12) {
    companionPose = "happy";
  }

  const handleAction = async (
    action: "accept" | "dismiss" | "snooze" | "talk" | "skip-today",
    payload?: string,
    interventionType?: string
  ) => {
    // ── Break-end alert specific actions ──────────────────────────────────────
    if (breakEndAlert) {
      if (action === "accept" && payload === "extend") {
        await handleExtendBreak();
        return;
      }
      // "Back to it" / "Still on break" / dismiss → just close the alert
      setBreakEndAlert(null);
      return;
    }

    // ── Timetable alert specific actions ──────────────────────────────────────
    if (timetableAlert) {
      const userTz = getUserTimezone(profile?.timezone);
      const dateStr = getTodayDateStr(userTz);
      if (action === "dismiss") {
        // "OK" — closes the alert (recorded in sessionStorage shown keys)
        setTimetableAlert(null);
        return;
      }
      if (action === "snooze") {
        // Snooze 10 minutes: suppress until now + 10m and unmark from shown set
        snoozeRef.current = { key: timetableAlert.key, until: Date.now() + 10 * 60 * 1000 };
        unmarkAlertShownToday(dateStr, timetableAlert.key);
        setTimetableAlert(null);
        return;
      }
      if (action === "skip-today") {
        // Skip today: suppresses timetable alerts for the rest of today
        skipTimetableToday(dateStr);
        setTimetableAlert(null);
        return;
      }
      if (action === "talk") {
        setTimetableAlert(null);
        router.push("/dashboard");
        return;
      }
      if (action === "accept" && payload?.startsWith("/")) {
        setTimetableAlert(null);
        router.push(payload);
        return;
      }
      setTimetableAlert(null);
      return;
    }

    if (action === "dismiss") {
      if (activeCheckIn) {
        dismissCheckIn();
      }
      setOpeningGreeting(null);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(DISMISSED_GREETING_KEY, "true");
      }
      return;
    }

    if (action === "talk") {
      if (activeCheckIn) {
        await respondToCheckIn("talk", interventionType);
      }
      setOpeningGreeting(null);
      router.push("/dashboard");
      return;
    }

    if (payload && payload.startsWith("/")) {
      if (activeCheckIn) {
        await respondToCheckIn(action === "snooze" ? "snooze" : "accept", interventionType);
      }
      setOpeningGreeting(null);
      router.push(payload);
      return;
    }

    if (activeCheckIn) {
      await respondToCheckIn(action === "snooze" ? "snooze" : "accept", interventionType);
    }
    setOpeningGreeting(null);
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number; y: number } }) => {
    if (Math.abs(info.offset.x) > 6 || Math.abs(info.offset.y) > 6) {
      isDraggingRef.current = true;
      const newPos = {
        x: position.x + info.offset.x,
        y: position.y + info.offset.y,
      };
      setPosition(newPos);
      try {
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(newPos));
      } catch {
        // Safe fallback
      }
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    }
  };

  const handleAvatarClick = () => {
    if (isDraggingRef.current) return;

    if (isMinimized) {
      handleRestoreFromDot();
      return;
    }

    if (displayedMessage) {
      // Tapping her opens the chat
      handleAction("talk", undefined, activeCheckIn?.interventionType);
      return;
    }

    setIsInteractiveOpen((prev) => !prev);
  };

  // Determine which speech bubble is active:
  // priority: server check-in > break-end alert > timetable alert > opening greeting
  const displayedMessage = activeCheckIn
    ? {
        title: companionName,
        message: activeCheckIn.message,
        subText: activeCheckIn.subText,
        actions: activeCheckIn.actions,
        isServerCheckIn: true,
        isTimetableAlert: false,
      }
    : breakEndAlert
      ? {
          title: companionName,
          message: breakEndAlert.message,
          subText: breakEndAlert.nextTaskTitle
            ? "Tap 'Back to it' when you're ready, or take 5 more minutes 🌙"
            : "No rush at all — whenever you feel ready! ✨",
          actions: breakEndAlert.extensionUsed
            ? [
                // Already extended once — just offer back-to-it
                { label: "Back to it 💪", action: "dismiss" as const, variant: "primary" as const },
                { label: "Still on break", action: "dismiss" as const, variant: "ghost" as const },
              ]
            : [
                { label: "Back to it 💪", action: "dismiss" as const, variant: "primary" as const },
                { label: "5 more minutes", action: "accept" as const, payload: "extend", variant: "secondary" as const },
                { label: "Still on break", action: "dismiss" as const, variant: "ghost" as const },
              ],
          isServerCheckIn: false,
          isTimetableAlert: false,
        }
      : timetableAlert
        ? {
            title: companionName,
            message: timetableAlert.message,
            subText: timetableAlert.subText,
            actions: [
              { label: "OK", action: "dismiss" as const, variant: "primary" as const },
              { label: "Snooze 10 min", action: "snooze" as const, variant: "secondary" as const },
              { label: "Skip today", action: "skip-today" as const, variant: "ghost" as const },
              { label: "View Timetable", action: "accept" as const, payload: "/plan?tab=schedule", variant: "ghost" as const },
            ],
            isServerCheckIn: false,
            isTimetableAlert: true,
          }
        : openingGreeting
          ? {
              title: companionName,
              message: openingGreeting.message,
              subText: openingGreeting.subText,
              actions: openingGreeting.actions,
              isServerCheckIn: false,
              isTimetableAlert: false,
            }
          : null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      animate={{ x: position.x, y: position.y }}
      transition={reduceMotion ? { duration: 0.1 } : { type: "spring", damping: 30, stiffness: 400 }}
      className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 flex flex-col items-end select-none transition-opacity duration-200 ${
        !isPositionLoaded ? "opacity-0" : isTyping ? "opacity-30 hover:opacity-100" : "opacity-100"
      }`}
    >
      {/* Speech Bubble: Goodbye Farewell */}
      <AnimatePresence>
        {goodbyeMessage && !isMinimized && (
          <motion.div
            key="goodbye-bubble"
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.25 }}
            className="pointer-events-auto mb-3 w-[calc(100vw-2rem)] sm:w-80 md:w-96 max-w-sm rounded-2xl border border-cyan-400/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 mb-2.5">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400" />
              <span className="font-mono text-xs font-semibold text-cyan-300">
                {companionName}
              </span>
              <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300/80 font-mono">
                Farewell
              </span>
            </div>
            <p className="font-display text-sm font-medium text-white leading-relaxed">
              &ldquo;{goodbyeMessage}&rdquo;
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speech Bubble: Active Check-In OR Opening Proactive Greeting */}
      <AnimatePresence>
        {displayedMessage && !goodbyeMessage && !isMinimized && !isTyping && (
          <motion.div
            key={activeCheckIn?.id || (breakEndAlert ? "break-end" : undefined) || openingGreeting?.id || "bubble"}
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: "spring", damping: 22, stiffness: 280 }
            }
            className="pointer-events-auto mb-3 w-[calc(100vw-2rem)] sm:w-80 md:w-96 max-w-sm rounded-2xl border border-cyan-400/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            {/* Header / Dismiss */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono text-xs font-semibold text-cyan-300">
                  {displayedMessage.title}
                </span>
                <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300/80 font-mono">
                  {activeCheckIn ? "Check-in" : breakEndAlert ? "Break Over" : timetableAlert ? "Schedule" : "Greetings"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMinimized(true);
                    try {
                      sessionStorage.setItem(MINIMIZED_STORAGE_KEY, "true");
                    } catch {}
                  }}
                  className="rounded-md p-1 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                  title="Minimize Nikki"
                  aria-label="Minimize Nikki"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("dismiss")}
                  className="rounded-md p-1 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                  title="Dismiss greeting"
                  aria-label="Dismiss greeting"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Message Body - Tapping opens chat */}
            <div
              onClick={() => handleAction("talk", undefined, activeCheckIn?.interventionType)}
              className="cursor-pointer group"
              title="Click to open chat"
            >
              <p className="font-display text-sm font-medium text-white leading-relaxed group-hover:text-cyan-200 transition-colors">
                &ldquo;{displayedMessage.message}&rdquo;
              </p>

              {displayedMessage.subText && (
                <p className="mt-1 text-xs text-ink-muted leading-normal">
                  {displayedMessage.subText}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {displayedMessage.actions.map((act, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant={act.variant === "primary" ? "primary" : act.variant === "secondary" ? "secondary" : "ghost"}
                  onClick={() => handleAction(act.action, act.payload, activeCheckIn?.interventionType)}
                  className="text-xs py-1 px-3 h-auto"
                >
                  {act.action === "talk" && <MessageCircle className="h-3 w-3 mr-1" />}
                  {act.action === "accept" && <Sparkles className="h-3 w-3 mr-1" />}
                  <span>{act.label}</span>
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speech Bubble: User-Tapped Quick Interaction Menu */}
      <AnimatePresence>
        {!displayedMessage && !goodbyeMessage && isInteractiveOpen && !isMinimized && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: "spring", damping: 22, stiffness: 280 }
            }
            className="pointer-events-auto mb-3 w-[calc(100vw-2rem)] sm:w-80 rounded-2xl border border-cyan-400/35 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-cyan-400" />
                <span className="font-mono text-xs font-semibold text-cyan-300">
                  {companionName}
                </span>
                <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300/80 font-mono">
                  Menu
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMinimized(true);
                    try {
                      sessionStorage.setItem(MINIMIZED_STORAGE_KEY, "true");
                    } catch {}
                  }}
                  className="rounded-md p-1 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                  title="Minimize"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsInteractiveOpen(false)}
                  className="rounded-md p-1 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <p className="font-display text-sm font-medium text-white leading-relaxed">
              {isLateNight
                ? `It's late, ${userName}! Make sure to take care of yourself and rest soon.`
                : currentHour < 12
                  ? `Good morning, ${userName}! I'm here with you—ready to tackle the day?`
                  : currentHour < 18
                    ? `Hope your day is flowing nicely, ${userName}. Need to plan or focus on anything?`
                    : `Evening, ${userName}! How are you feeling right now?`}
            </p>

            <div className="mt-3.5 flex flex-col gap-1.5">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setIsInteractiveOpen(false);
                  router.push("/dashboard");
                }}
                className="text-xs justify-start h-8"
              >
                <MessageCircle className="h-3.5 w-3.5 mr-2" />
                <span>Chat with {companionName}</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleByeNikki}
                className="text-xs justify-start h-8 text-cyan-200/90 hover:text-white hover:bg-white/10"
              >
                <Hand className="h-3.5 w-3.5 mr-2 text-cyan-400" />
                <span>Bye {companionName}</span>
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setIsInteractiveOpen(false);
                  router.push("/plan?tab=schedule");
                }}
                className="text-xs justify-start h-8"
              >
                <Calendar className="h-3.5 w-3.5 mr-2" />
                <span>Today's Timetable</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsInteractiveOpen(false);
                  router.push("/focus");
                }}
                className="text-xs justify-start h-8"
              >
                <Sparkles className="h-3.5 w-3.5 mr-2" />
                <span>Start Focus Session</span>
              </Button>

              {/* Break mode — show "End break" if one is active, otherwise "Take a break" */}
              {activeBreak ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsInteractiveOpen(false);
                    handleCancelBreak();
                  }}
                  className="text-xs justify-start h-8 text-amber-300/90 hover:text-white hover:bg-amber-500/10"
                >
                  <Coffee className="h-3.5 w-3.5 mr-2 text-amber-400" />
                  <span>End break early</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setBreakPickerOpen(true);
                    setIsInteractiveOpen(false);
                  }}
                  className="text-xs justify-start h-8 text-amber-300/90 hover:text-white hover:bg-amber-500/10"
                >
                  <Coffee className="h-3.5 w-3.5 mr-2 text-amber-400" />
                  <span>Take a break</span>
                </Button>
              )}

              <div className="border-t border-white/10 pt-2 flex items-center justify-between text-[11px] text-ink-muted">
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  className="hover:text-rose-400 transition-colors"
                >
                  Hide for now
                </button>
                <span className="text-ink-muted/50">Draggable</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Break Picker Panel */}
      <AnimatePresence>
        {breakPickerOpen && !isMinimized && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: "spring", damping: 22, stiffness: 280 }
            }
            className="pointer-events-auto mb-3 w-[calc(100vw-2rem)] sm:w-80 rounded-2xl border border-amber-400/35 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Coffee className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-mono text-xs font-semibold text-amber-300">Break time</span>
              </div>
              <button
                type="button"
                onClick={() => setBreakPickerOpen(false)}
                className="rounded-md p-1 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="font-display text-sm font-medium text-white leading-relaxed mb-3">
              How long do you need? I&apos;ll stay quiet until then 🌙
            </p>

            {/* Preset buttons */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[15, 30, 60].map((mins) => (
                <Button
                  key={mins}
                  size="sm"
                  variant="secondary"
                  onClick={() => handleStartBreak(mins)}
                  className="text-xs h-9 font-medium"
                >
                  {mins} min
                </Button>
              ))}
            </div>

            {/* Custom duration */}
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={480}
                placeholder="Custom (min)"
                value={customMinutesInput}
                onChange={(e) => setCustomMinutesInput(e.target.value)}
                className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white placeholder-ink-muted focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30"
              />
              <Button
                size="sm"
                variant="primary"
                disabled={!customMinutesInput || Number(customMinutesInput) < 1}
                onClick={() => {
                  const mins = parseInt(customMinutesInput, 10);
                  if (mins >= 1) handleStartBreak(mins);
                }}
                className="text-xs px-3 h-auto bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950"
              >
                Go
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Draggable Avatar Widget */}
      <div className="relative flex items-center gap-2">
        {isMinimized ? (
          // Minimized Small Dot
          <motion.button
            type="button"
            whileHover={reduceMotion ? {} : { scale: 1.3 }}
            whileTap={reduceMotion ? {} : { scale: 0.85 }}
            onClick={handleRestoreFromDot}
            className="pointer-events-auto relative flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.85)] hover:bg-cyan-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-300"
            title={`Tap to wake ${companionName}`}
            aria-label={`Tap to wake ${companionName}`}
          >
            {!reduceMotion && (
              <span className="absolute -inset-1 rounded-full bg-cyan-400/40 animate-ping pointer-events-none" />
            )}
            <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />
          </motion.button>
        ) : (
          // Full Floating Avatar with gentle idle hover
          <motion.div
            animate={reduceMotion ? { y: 0 } : { y: [0, -4, 0] }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <motion.div
              whileHover={reduceMotion ? {} : { scale: 1.06 }}
              whileTap={reduceMotion ? {} : { scale: 0.94 }}
              className="pointer-events-auto relative group cursor-grab active:cursor-grabbing"
              onClick={handleAvatarClick}
              title={`Drag to reposition · Click to interact with ${companionName}`}
            >
              {/* Glow ambient background halo */}
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500/25 to-teal-500/25 blur-md opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="relative flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full border border-cyan-400/45 bg-slate-900/90 shadow-xl backdrop-blur-md">
                <div className="h-9 w-9 md:h-10 md:w-10">
                  <CompanionCharacter pose={companionPose} className="h-full w-full" />
                </div>

                {/* Active check-in / break-end alert badge */}
                {activeBreak && !breakEndAlert ? (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow-md" title="Break active">
                    <Coffee className="h-2.5 w-2.5 text-slate-950" />
                  </span>
                ) : (activeCheckIn || openingGreeting || breakEndAlert) ? (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[10px] text-slate-950 font-bold shadow-md animate-bounce">
                    !
                  </span>
                ) : null}

                {/* Subtle drag handle indicator on hover */}
                <div className="absolute -bottom-1 inset-x-0 flex justify-center opacity-0 group-hover:opacity-75 transition-opacity">
                  <div className="rounded-full bg-slate-800 px-1 py-0.5 border border-white/20">
                    <Move className="h-2 w-2 text-ink-muted" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
