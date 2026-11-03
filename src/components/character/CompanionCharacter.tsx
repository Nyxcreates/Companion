"use client";

import { motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { ease } from "@/lib/motion";

export type CompanionPose = "idle" | "walk" | "turn" | "wave" | "lookAhead" | "sit" | "think" | "celebrate";

interface CompanionCharacterProps {
  pose?: CompanionPose;
  className?: string;
}

/**
 * The default, temporary Companion character.
 *
 * This is NOT the final character design — no Live2D, no customization,
 * no final art. Every scene should render <CompanionCharacter /> rather
 * than drawing the character itself, so replacing this with the real
 * character system later means changing only this file.
 *
 * Pose set intentionally stays small: only what the story actually asks
 * for (idle/walk/turn/wave/lookAhead, plus sit/think/celebrate added for
 * the Focus, Relationship and Growth scenes). This is a placeholder, not
 * a place to invest in a full expression system.
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
        return { rotate: -4 };
      case "celebrate":
        return { y: [0, -10, 0] };
      default:
        return { y: 0, scaleX: 1, scaleY: 1, rotate: 0 };
    }
  })();

  const bodyTransition =
    pose === "walk" && !prefersReducedMotion
      ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" as const }
      : pose === "celebrate" && !prefersReducedMotion
        ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" as const }
        : { duration: 0.8, ease: ease.standard };

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

          {/* face — shifts slightly toward the path ahead in the lookAhead pose */}
          <motion.g
            animate={pose === "lookAhead" ? { x: 5 } : { x: 0 }}
            transition={{ duration: 0.9, ease: ease.standard }}
          >
            <circle cx="38" cy="46" r="4" fill="var(--text-primary)" />
            <circle cx="62" cy="46" r="4" fill="var(--text-primary)" />
            <path
              d="M40 60 Q50 68 60 60"
              stroke="var(--text-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </motion.g>

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