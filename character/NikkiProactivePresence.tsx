"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MessageCircle, X, Clock, Heart } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { useProfile } from "@/context/ProfileContext";
import { CompanionCharacter, type CompanionPose } from "./CompanionCharacter";
import { Button } from "@/components/ui/Button";

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
  const [isTyping, setIsTyping] = useState(false);

  // Monitor if user is currently typing in an input/textarea to avoid interrupting them
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
  if (floatingMode === "off") {
    return null;
  }

  const companionPose = activeCheckIn
    ? mapGuidePoseToCompanionPose(activeCheckIn.characterPose)
    : "idle";

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

  return (
    <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 flex flex-col items-end pointer-events-none">
      {/* Speech Bubble Popup (When activeCheckIn is present and user is not mid-typing) */}
      <AnimatePresence>
        {activeCheckIn && !isMinimized && !isTyping && (
          <motion.div
            key={activeCheckIn.id}
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="pointer-events-auto mb-3 w-80 sm:w-96 rounded-2xl border border-cyan-400/30 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            {/* Header / Dismiss */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-mono text-xs font-semibold text-cyan-300">
                  {companionName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismissCheckIn()}
                className="rounded-md p-1 text-ink-muted hover:bg-white/10 hover:text-white transition-colors"
                title="Dismiss check-in"
              >
                <X className="h-3.5 w-3.5" />
              </button>
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

      {/* Floating Avatar Widget */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="pointer-events-auto relative group cursor-pointer"
        onClick={() => {
          if (activeCheckIn) {
            setIsMinimized((prev) => !prev);
          } else {
            router.push("/dashboard");
          }
        }}
        title={`${companionName} is here`}
      >
        {/* Glow ambient background */}
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-teal-500/20 blur-md opacity-75 group-hover:opacity-100 transition-opacity" />

        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-900/90 shadow-lg backdrop-blur-md">
          <div className="h-10 w-10">
            <CompanionCharacter pose={companionPose} className="h-full w-full" />
          </div>

          {/* Active alert indicator pill */}
          {activeCheckIn && isMinimized && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[10px] text-slate-950 font-bold shadow-md animate-bounce">
              !
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}

