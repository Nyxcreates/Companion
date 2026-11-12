"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MessageCircle, X, Clock, Calendar, Minimize2, Move, Eye } from "lucide-react";
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
const LAST_GREETING_TIME_KEY = "companion:last-greeting-time";
const LAST_GREETING_TEXT_KEY = "companion:last-greeting-text";
const LAST_CHAT_MESSAGE_KEY = "companion:last-chat-message-time";

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

export function NikkiProactivePresence() {
  const router = useRouter();
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
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPositionLoaded, setIsPositionLoaded] = useState(false);
  const isDraggingRef = useRef(false);

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

    // Check if greeting was already dismissed in this browser session
    const sessionDismissed = sessionStorage.getItem(DISMISSED_GREETING_KEY);
    if (sessionDismissed === "true") return;

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
      sessionStorage.setItem(LAST_GREETING_TIME_KEY, now.getTime().toString());
      setOpeningGreeting(greeting);
    }
  }, [firebaseUser, companionName, userName]);

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
    action: "accept" | "dismiss" | "snooze" | "talk",
    payload?: string,
    interventionType?: string
  ) => {
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
        await respondToCheckIn(action, interventionType);
      }
      setOpeningGreeting(null);
      router.push(payload);
      return;
    }

    if (activeCheckIn) {
      await respondToCheckIn(action, interventionType);
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
      setIsMinimized(false);
      return;
    }

    if (activeCheckIn || openingGreeting) {
      setIsInteractiveOpen(false);
    } else {
      setIsInteractiveOpen((prev) => !prev);
    }
  };

  // Determine which speech bubble is active: server check-in takes precedence, then opening greeting
  const displayedMessage = activeCheckIn
    ? {
        title: companionName,
        message: activeCheckIn.message,
        subText: activeCheckIn.subText,
        actions: activeCheckIn.actions,
        isServerCheckIn: true,
      }
    : openingGreeting
      ? {
          title: companionName,
          message: openingGreeting.message,
          subText: openingGreeting.subText,
          actions: openingGreeting.actions,
          isServerCheckIn: false,
        }
      : null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", damping: 30, stiffness: 400 }}
      className={`fixed bottom-24 md:bottom-8 right-4 md:right-8 z-40 flex flex-col items-end select-none transition-opacity duration-200 ${
        !isPositionLoaded ? "opacity-0" : isTyping ? "opacity-30 hover:opacity-100" : "opacity-100"
      }`}
    >
      {/* Speech Bubble: Active Check-In OR Opening Proactive Greeting */}
      <AnimatePresence>
        {displayedMessage && !isMinimized && !isTyping && (
          <motion.div
            key={activeCheckIn?.id || openingGreeting?.id || "bubble"}
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="pointer-events-auto mb-3 w-80 sm:w-96 rounded-2xl border border-cyan-400/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            {/* Header / Dismiss */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono text-xs font-semibold text-cyan-300">
                  {displayedMessage.title}
                </span>
                <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300/80 font-mono">
                  {activeCheckIn ? "Check-in" : "Greetings"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
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

            {/* Message Body */}
            <p className="font-display text-sm font-medium text-white leading-relaxed">
              &ldquo;{displayedMessage.message}&rdquo;
            </p>

            {displayedMessage.subText && (
              <p className="mt-1 text-xs text-ink-muted leading-normal">
                {displayedMessage.subText}
              </p>
            )}

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
        {!displayedMessage && isInteractiveOpen && !isMinimized && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="pointer-events-auto mb-3 w-72 sm:w-80 rounded-2xl border border-cyan-400/35 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-cyan-400" />
                <span className="font-mono text-xs font-semibold text-cyan-300">
                  {companionName}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
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
                ? "It's late, moon! Make sure to take care of yourself and rest soon."
                : currentHour < 12
                  ? "Good morning! I'm here with you—ready to tackle the day?"
                  : currentHour < 18
                    ? "Hope your day is flowing nicely. Need to plan or focus on anything?"
                    : "Evening! How are you feeling right now?"}
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

      {/* Floating Draggable Avatar Widget */}
      <div className="relative flex items-center gap-2">
        {isMinimized ? (
          // Minimized Pill / Orb
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsMinimized(false)}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-slate-900/90 px-3 py-1.5 shadow-lg backdrop-blur-md cursor-pointer hover:border-cyan-400"
            title={`Click to expand ${companionName}`}
          >
            <div className="h-5 w-5">
              <CompanionCharacter pose="idle" className="h-full w-full" />
            </div>
            <span className="font-mono text-xs font-medium text-cyan-300">{companionName}</span>
          </motion.div>
        ) : (
          // Full Floating Avatar
          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="pointer-events-auto relative group cursor-grab active:cursor-grabbing"
            onClick={handleAvatarClick}
            title={`Drag to reposition · Click to interact with ${companionName}`}
          >
            {/* Glow ambient background halo */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500/25 to-teal-500/25 blur-md opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/45 bg-slate-900/90 shadow-xl backdrop-blur-md">
              <div className="h-10 w-10">
                <CompanionCharacter pose={companionPose} className="h-full w-full" />
              </div>

              {/* Active check-in alert badge */}
              {(activeCheckIn || openingGreeting) && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[10px] text-slate-950 font-bold shadow-md animate-bounce">
                  !
                </span>
              )}

              {/* Subtle drag handle indicator on hover */}
              <div className="absolute -bottom-1 inset-x-0 flex justify-center opacity-0 group-hover:opacity-75 transition-opacity">
                <div className="rounded-full bg-slate-800 px-1 py-0.5 border border-white/20">
                  <Move className="h-2 w-2 text-ink-muted" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
