"use client";

import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { ease } from "@/lib/motion";

export type CompanionPose =
  | "idle"
  | "walk"
  | "turn"
  | "wave"
  | "lookAhead"
  | "sit"
  | "think"
  | "celebrate"
  | "sleepy"
  | "concerned"
  | "happy"
  | "curious";

interface CompanionCharacterProps {
  pose?: CompanionPose;
  className?: string;
  isBlinking?: boolean;
}

/**
 * Nikki Living Character Avatar.
 * Supports smooth idle breathing, natural blinking, subtle eye gaze,
 * and expressive poses: idle, wave, happy/celebrate, think, sleepy, concerned.
 */
export function CompanionCharacter({ pose = "idle", className }: CompanionCharacterProps) {
  const prefersReducedMotion = useReducedMotion();

  const bodyAnimation = (() => {
    if (prefersReducedMotion) return { y: 0, scaleX: 1, scaleY: 1, rotate: 0 };
    switch (pose) {
      case "walk":
        return { y: [0, -3, 0] };
      case "turn":
        return { scaleX: [1, 0.84, 1] };
      case "sit":
        return { y: 6, scaleY: 0.88 };
      case "think":
        return { rotate: [-2, -5, -2], y: [0, -2, 0] };
      case "celebrate":
      case "happy":
        return { y: [0, -8, 0], scale: [1, 1.04, 1] };
      case "sleepy":
        return { y: [0, 3, 0], scaleY: [1, 0.97, 1] };
      case "concerned":
        return { rotate: [1, 3, 1], y: [0, -1, 0] };
      case "curious":
        return { rotate: [0, 4, 0], y: [0, -3, 0], scale: [1, 1.03, 1] };
      case "wave":
        return { y: [0, -3, 0], rotate: [0, 2, 0] };
      case "idle":
      default:
        return { y: [0, -3, 0], scale: [1, 1.02, 1] };
    }
  })();

  const bodyTransition = (() => {
    if (prefersReducedMotion) return { duration: 0.2 };
    switch (pose) {
      case "walk":
        return { duration: 0.6, repeat: Infinity, ease: "easeInOut" as const };
      case "celebrate":
      case "happy":
        return { duration: 0.8, repeat: Infinity, ease: "easeInOut" as const };
      case "sleepy":
        return { duration: 3.5, repeat: Infinity, ease: "easeInOut" as const };
      case "wave":
        return { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const };
      case "think":
      case "concerned":
      case "curious":
        return { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const };
      case "idle":
      default:
        return { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const };
    }
  })();

  return (
    <div className={clsx("relative", className)} role="img" aria-label="Your companion">
      <div
        className="absolute inset-0 rounded-full opacity-50 blur-2xl"
        style={{ background: "radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <motion.div className="relative h-full w-full" animate={bodyAnimation} transition={bodyTransition}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="var(--accent-primary)" opacity="0.85" />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--accent-secondary)"
            strokeWidth="1.5"
            opacity="0.4"
          />

          {/* face — shifts subtly, blinks naturally, and changes expressions based on pose */}
          <motion.g
            animate={
              prefersReducedMotion
                ? {}
                : pose === "lookAhead"
                  ? { x: 5 }
                  : pose === "think"
                    ? { y: -1, x: -1 }
                    : { x: [0, 1, -1, 0] }
            }
            transition={{
              duration: pose === "lookAhead" ? 0.9 : 5,
              repeat: pose === "lookAhead" ? 0 : Infinity,
              ease: ease.standard,
            }}
          >
            {pose === "sleepy" ? (
              // Sleepy / resting eyes
              <>
                <path d="M34 48 Q38 52 42 48" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M58 48 Q62 52 66 48" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M44 61 Q50 63 56 61" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
              </>
            ) : pose === "happy" || pose === "celebrate" ? (
              // Cheerful joyful eyes & broad smile
              <>
                <path d="M34 48 Q38 43 42 48" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M58 48 Q62 43 66 48" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M38 58 Q50 70 62 58" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </>
            ) : pose === "concerned" ? (
              // Sympathetic, gentle concerned face
              <>
                <motion.g
                  animate={prefersReducedMotion ? {} : { scaleY: [1, 1, 0.1, 1, 1] }}
                  transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}
                  style={{ transformOrigin: "50px 46px" }}
                >
                  <circle cx="38" cy="46" r="4" fill="var(--text-primary)" />
                  <circle cx="62" cy="46" r="4" fill="var(--text-primary)" />
                </motion.g>
                <path d="M34 39 Q38 42 42 40" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <path d="M58 40 Q62 42 66 39" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <path d="M42 62 Q50 57 58 62" stroke="var(--text-primary)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </>
            ) : pose === "curious" ? (
              // Inquisitive, attentive curious face with wide sparkling eyes and cute smile
              <>
                <motion.g
                  animate={prefersReducedMotion ? {} : { scaleY: [1, 1, 0.08, 1, 1] }}
                  transition={{ duration: 3.8, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}
                  style={{ transformOrigin: "50px 46px" }}
                >
                  <circle cx="38" cy="45" r="4.5" fill="var(--text-primary)" />
                  <circle cx="40" cy="43.5" r="1.3" fill="white" />
                  <circle cx="62" cy="45" r="4.5" fill="var(--text-primary)" />
                  <circle cx="64" cy="43.5" r="1.3" fill="white" />
                </motion.g>
                <path d="M35 38 Q38 35 42 37" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <path d="M58 37 Q62 35 65 38" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <path d="M44 60 Q50 65 56 60" stroke="var(--text-primary)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </>
            ) : (
              // Idle / Wave / Think with natural blinking
              <>
                <motion.g
                  animate={prefersReducedMotion ? {} : { scaleY: [1, 1, 0.08, 1, 1] }}
                  transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1], ease: "easeInOut" }}
                  style={{ transformOrigin: "50px 46px" }}
                >
                  <circle cx="38" cy="46" r="4" fill="var(--text-primary)" />
                  <circle cx="62" cy="46" r="4" fill="var(--text-primary)" />
                </motion.g>
                <path
                  d="M40 60 Q50 68 60 60"
                  stroke="var(--text-primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            )}
          </motion.g>

          {/* Sleepy floating Z particles */}
          {pose === "sleepy" && !prefersReducedMotion && (
            <motion.text
              x="72"
              y="28"
              fill="var(--accent-secondary)"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
              animate={{ opacity: [0, 0.85, 0], y: [28, 18, 10], x: [72, 78, 84] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeOut" }}
            >
              zZ
            </motion.text>
          )}

          {/* a simple arm — only present during the wave pose */}
          {pose === "wave" && (
            <motion.path
              d="M74 58 Q86 52 88 34"
              stroke="var(--text-primary)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              style={{ transformOrigin: "74px 58px" }}
              animate={prefersReducedMotion ? { rotate: 12 } : { rotate: [0, 20, -8, 16, 0] }}
              transition={prefersReducedMotion ? { duration: 0.4 } : { duration: 1.6, ease: "easeInOut" }}
            />
          )}

          {/* a raised hand near the chin — only present while thinking */}
          {pose === "think" && (
            <path
              d="M62 60 Q72 52 70 40"
              stroke="var(--text-primary)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* small sparkles — only present while celebrating */}
          {pose === "celebrate" && !prefersReducedMotion && (
            <>
              <motion.circle
                cx="20"
                cy="30"
                r="2.5"
                fill="var(--accent-secondary)"
                animate={{ opacity: [0, 1, 0], y: [0, -8, -14] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <motion.circle
                cx="82"
                cy="26"
                r="2"
                fill="var(--accent-gold)"
                animate={{ opacity: [0, 1, 0], y: [0, -6, -12] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }}
              />
            </>
          )}
        </svg>
      </motion.div>
    </div>
  );
}