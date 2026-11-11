"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export type GuidePose = "greet" | "idle" | "point" | "ponder" | "celebrate" | "walk";
export type GuideGaze = "center" | "left" | "right" | "up";

interface LivingCompanionGuideProps {
  pose?: GuidePose;
  gaze?: GuideGaze;
  dialogueText?: string;
  subText?: string;
  reactionCue?: string | null;
  className?: string;
  customCharacterComponent?: ReactNode;
  name?: string;
}

export function LivingCompanionGuide({
  pose = "idle",
  gaze = "center",
  dialogueText,
  subText,
  reactionCue,
  className = "",
  customCharacterComponent,
  name = "Nikki",
}: LivingCompanionGuideProps) {
  const prefersReducedMotion = useReducedMotion();

  // Calculate eye gaze offsets
  const eyeOffset = (() => {
    switch (gaze) {
      case "left":
        return { x: -3.5, y: -0.5 };
      case "right":
        return { x: 3.5, y: -0.5 };
      case "up":
        return { x: 0, y: -3.5 };
      default:
        return { x: 0, y: 0 };
    }
  })();

  // Character body breathing & movement animation
  const bodyAnimation = (() => {
    if (prefersReducedMotion) return { y: 0, scale: 1, rotate: 0 };
    switch (pose) {
      case "greet":
        return { y: [0, -6, 0], scale: [1, 1.02, 1], rotate: [0, 2, -1, 0] };
      case "point":
        return { y: [0, -3, 0], rotate: [0, 2, 0] };
      case "ponder":
        return { y: [0, -2, 0], rotate: [-3, -4, -3] };
      case "celebrate":
        return { y: [0, -10, 0], scale: [1, 1.05, 1], rotate: [0, -2, 2, 0] };
      case "walk":
        return { y: [0, -5, 0], x: [-2, 2, -2] };
      default: // idle
        return { y: [0, -4, 0], scale: [1, 1.015, 1] };
    }
  })();

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Dynamic Contextual Reaction Pill (When user clicks interactive objects) */}
      {reactionCue && (
        <motion.div
          key={reactionCue}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/50 bg-slate-900/90 px-3.5 py-1 text-xs text-cyan-200 shadow-[0_0_15px_rgba(94,231,224,0.3)] backdrop-blur-md"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          <span>{reactionCue}</span>
        </motion.div>
      )}

      {/* Primary Dialogue Speech Bubble */}
      {dialogueText && (
        <motion.div
          key={dialogueText}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative mb-5 max-w-xl rounded-2xl border border-white/15 bg-slate-900/85 p-4 sm:p-5 text-center shadow-xl backdrop-blur-xl"
        >
          {/* Guide Badge */}
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400" />
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-cyan-300">
              {name} · Your Companion Guide
            </span>
          </div>

          {/* Dialogue Paragraph */}
          <p className="font-display text-xl font-light tracking-wide text-white sm:text-2xl">
            &ldquo;{dialogueText}&rdquo;
          </p>

          {subText && (
            <p className="mt-2 text-sm text-ink-secondary sm:text-base">
              {subText}
            </p>
          )}

          {/* Speech Bubble Pointer */}
          <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-white/15 bg-slate-900/85" />
        </motion.div>
      )}

      {/* Guide Visual Presentation (Decoupled Stage Slot) */}
      <div className="relative flex items-center justify-center">
        {/* Soft Aura Glow */}
        <motion.div
          className="pointer-events-none absolute h-36 w-36 rounded-full blur-2xl"
          style={{
            background:
              pose === "celebrate"
                ? "radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, rgba(124, 92, 255, 0.25) 50%, transparent 70%)"
                : "radial-gradient(circle, rgba(94, 231, 224, 0.35) 0%, rgba(124, 92, 255, 0.2) 50%, transparent 70%)",
          }}
          animate={
            prefersReducedMotion
              ? {}
              : { scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }
          }
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Modular Custom Character Component Slot (for future Live2D/3D model) */}
        {customCharacterComponent ? (
          <div className="relative z-10">{customCharacterComponent}</div>
        ) : (
          /* Default Expressive Animated Vector Character Guide */
          <motion.div
            className="relative z-10 flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32"
            animate={bodyAnimation}
            transition={{
              duration: pose === "walk" ? 0.8 : 3.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full" fill="none">
              <defs>
                <linearGradient id="guideBody" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--accent-secondary, #7c5cff)" />
                  <stop offset="0.6" stopColor="var(--accent-primary, #5ee7e0)" />
                  <stop offset="1" stopColor="var(--accent-secondary, #c084fc)" />
                </linearGradient>
                <linearGradient id="haloRing" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                  <stop stopColor="var(--world-halo, #ffd166)" />
                  <stop offset="1" stopColor="var(--accent-primary, #5ee7e0)" />
                </linearGradient>
              </defs>

              {/* Celestial Floating Halo */}
              <motion.ellipse
                cx="50"
                cy="22"
                rx="24"
                ry="7"
                stroke="url(#haloRing)"
                strokeWidth="1.8"
                fill="none"
                animate={
                  prefersReducedMotion
                    ? {}
                    : { y: [0, -2, 0], opacity: [0.75, 1, 0.75] }
                }
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Soft Luminous Orb Head */}
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="url(#guideBody)"
                className="drop-shadow-[0_0_15px_rgba(94,231,224,0.5)]"
              />
              <circle cx="50" cy="50" r="38" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.2" />

              {/* Eyes with Directional Gaze and Blink Cycle */}
              <motion.g
                animate={{ x: eyeOffset.x, y: eyeOffset.y }}
                transition={{ duration: 0.4 }}
              >
                {/* Left Eye */}
                <motion.ellipse
                  cx="38"
                  cy="48"
                  rx="4"
                  ry="5.5"
                  fill="#ffffff"
                  animate={
                    prefersReducedMotion
                      ? {}
                      : { scaleY: [1, 1, 0.1, 1, 1] }
                  }
                  transition={{
                    duration: 4.5,
                    repeat: Infinity,
                    times: [0, 0.9, 0.93, 0.96, 1],
                  }}
                  className="drop-shadow-[0_0_4px_#ffffff]"
                />
                {/* Right Eye */}
                <motion.ellipse
                  cx="62"
                  cy="48"
                  rx="4"
                  ry="5.5"
                  fill="#ffffff"
                  animate={
                    prefersReducedMotion
                      ? {}
                      : { scaleY: [1, 1, 0.1, 1, 1] }
                  }
                  transition={{
                    duration: 4.5,
                    repeat: Infinity,
                    times: [0, 0.9, 0.93, 0.96, 1],
                  }}
                  className="drop-shadow-[0_0_4px_#ffffff]"
                />
              </motion.g>

              {/* Friendly Mouth Expression */}
              {pose === "ponder" ? (
                <ellipse cx="50" cy="62" rx="3" ry="2" fill="#ffffff" />
              ) : pose === "celebrate" ? (
                <path
                  d="M38 60 Q50 72 62 60 Z"
                  fill="#ffffff"
                  className="drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                />
              ) : (
                <path
                  d="M40 59 Q50 67 60 59"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              )}

              {/* Cheerful Blush Cheeks */}
              <circle cx="30" cy="54" r="4.5" fill="#f472b6" opacity="0.45" />
              <circle cx="70" cy="54" r="4.5" fill="#f472b6" opacity="0.45" />

              {/* Gesturing Arms */}
              {pose === "greet" && (
                <motion.path
                  d="M74 58 Q88 48 88 32"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  fill="none"
                  animate={
                    prefersReducedMotion
                      ? {}
                      : { rotate: [0, 8, -6, 0] }
                  }
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: "74px 58px" }}
                />
              )}
              {pose === "point" && (
                <motion.path
                  d="M74 58 Q90 50 96 42"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  fill="none"
                />
              )}
              {pose === "celebrate" && (
                <>
                  <path d="M26 58 Q14 44 14 30" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                  <path d="M74 58 Q86 44 86 30" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                </>
              )}
            </svg>
          </motion.div>
        )}
      </div>
    </div>
  );
}
