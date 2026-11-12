"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MessageCircle, X, Clock, Calendar, Minimize2, Move } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { useProfile } from "@/context/ProfileContext";
import { CompanionCharacter, type CompanionPose } from "./CompanionCharacter";
import { Button } from "@/components/ui/Button";

const POSITION_STORAGE_KEY = "companion:nikki-floating-pos";

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
    case "idle":
    default:
      return "idle";
  }
}

export function NikkiProactivePresence() {
  const router = useRouter();
  const { profile } = useProfile();
  const { preferences, activeCheckIn, respondToCheckIn, dismissCheckIn } = useNotifications();
  const companionName = profile?.companionName || "Nikki";

  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isInteractiveOpen, setIsInteractiveOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPositionLoaded, setIsPositionLoaded] = useState(false);
  const isDraggingRef = useRef(false);

  // Load remembered position from localStorage
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

  // Monitor if user is typing in an input/textarea to avoid obstructing their view
  useEffect(() => {
    function handleFocus(e: FocusEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
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

  const floatingMode = preferences?.floatingPresence ?? "always";
  if (floatingMode === "off" || isDismissed) {
    return null;
  }

  // Derive pose based on active check-in or time of day
  const currentHour = new Date().getHours();
  const isLateNight = currentHour >= 23 || currentHour < 5;

  let companionPose: CompanionPose = "idle";
  if (activeCheckIn) {
    companionPose = mapGuidePoseToCompanionPose(activeCheckIn.characterPose);
  } else if (isInteractiveOpen) {
    companionPose = "wave";
  } else if (isLateNight) {
    companionPose = "sleepy";
  } else if (currentHour >= 6 && currentHour < 10) {
    companionPose = "idle";
  }

  const handleAction = async (
    action: "accept" | "dismiss" | "snooze" | "talk",
    payload?: string,
    interventionType?: string
  ) => {
    if (action === "talk") {
      await respondToCheckIn("talk", interventionType);
      router.push("/dashboard");
      return;
    }

    if (payload && payload.startsWith("/")) {
      await respondToCheckIn(action, interventionType);
      router.push(payload);
      return;
    }

    await respondToCheckIn(action, interventionType);
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number; y: number } }) => {
    // Only register as drag if moved more than 6 pixels to differentiate from a click
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

    if (activeCheckIn) {
      setIsInteractiveOpen(false);
    } else {
      setIsInteractiveOpen((prev) => !prev);
    }
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", damping: 30, stiffness: 400 }}
      className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 flex flex-col items-end select-none ${
        !isPositionLoaded ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Speech Bubble Popup: Active Proactive Check-In */}
      <AnimatePresence>
        {activeCheckIn && !isMinimized && !isTyping && (
          <motion.div
            key={activeCheckIn.id}
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="pointer-events-auto mb-3 w-80 sm:w-96 rounded-2xl border border-cyan-400/35 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            {/* Header / Dismiss */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
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
                  aria-label="Minimize Nikki"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => dismissCheckIn()}
                  className="rounded-md p-1 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                  title="Dismiss check-in"
                  aria-label="Dismiss check-in"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Message Body */}
            <p className="font-display text-sm font-medium text-white leading-relaxed">
              &ldquo;{activeCheckIn.message}&rdquo;
            </p>

            {activeCheckIn.subText && (
              <p className="mt-1 text-xs text-ink-muted leading-normal">
                {activeCheckIn.subText}
              </p>
            )}

            {/* Actions */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeCheckIn.actions.map((act, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant={act.variant === "primary" ? "primary" : act.variant === "secondary" ? "secondary" : "ghost"}
                  onClick={() =>
                    handleAction(act.action, act.payload, activeCheckIn.interventionType)
                  }
                  className="text-xs py-1 px-3 h-auto"
                >
                  {act.action === "talk" && <MessageCircle className="h-3 w-3 mr-1" />}
                  {act.action === "snooze" && <Clock className="h-3 w-3 mr-1" />}
                  {act.action === "accept" && <Sparkles className="h-3 w-3 mr-1" />}
                  <span>{act.label}</span>
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speech Bubble Popup: User-Tapped Quick Interaction Menu */}
      <AnimatePresence>
        {!activeCheckIn && isInteractiveOpen && !isMinimized && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="pointer-events-auto mb-3 w-72 sm:w-80 rounded-2xl border border-accent-secondary/35 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-accent-secondary" />
                <span className="font-mono text-xs font-semibold text-accent-secondary">
                  {companionName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsInteractiveOpen(false)}
                className="rounded-md p-1 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="font-display text-sm font-medium text-white leading-relaxed">
              {isLateNight
                ? "It's pretty late! Make sure to take care of yourself and rest soon."
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
              {activeCheckIn && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[10px] text-slate-950 font-bold shadow-md animate-bounce">
                  !
                </span>
              )}

              {/* Subtle drag handle indicator on hover */}
              <div className="absolute -bottom-1 inset-x-0 flex justify-center opacity-0 group-hover:opacity-75 transition-opacity">
                <div className="rounded-full bg-slate-800 px-1 py-0.2 border border-white/20">
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
