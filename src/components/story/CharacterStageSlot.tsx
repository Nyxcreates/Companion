"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import clsx from "clsx";

interface CharacterStageSlotProps {
  className?: string;
  customCharacterComponent?: ReactNode;
  ariaLabel?: string;
  glowColor?: string;
}

/**
 * Modular Character Stage Slot.
 *
 * This component reserves a clearly defined, isolated visual stage for Nikki
 * without hardcoding a final character design or anime illustration.
 *
 * Integration Architecture:
 * - When Nikki's final customizable character system is integrated (Live2D, 3D, or SVG canvas),
 *   pass that component into `customCharacterComponent`.
 * - The pedestal of light, ambient particle cradle, and background aura are fully decoupled
 *   from character art, so character poses and expressions can evolve independently.
 */
export function CharacterStageSlot({
  className,
  customCharacterComponent,
  ariaLabel = "Companion Presence",
  glowColor = "rgba(124, 92, 255, 0.35)",
}: CharacterStageSlotProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={clsx("relative flex flex-col items-center justify-center", className)}
    >
      {/* 1. Ambient back-glow / halo */}
      <motion.div
        className="pointer-events-none absolute -inset-8 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, rgba(94, 231, 224, 0.15) 45%, transparent 70%)`,
        }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.7 }
            : { opacity: [0.55, 0.85, 0.55], scale: [0.96, 1.05, 0.96] }
        }
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />

      {/* 2. Character Anchor or Custom Avatar */}
      <div className="relative z-10 flex items-center justify-center">
        {customCharacterComponent ? (
          customCharacterComponent
        ) : (
          /* Default Ethereal Presence: An elegant celestial presence symbolizing Nikki */
          <motion.div
            className="relative flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44"
            animate={
              prefersReducedMotion
                ? {}
                : { y: [0, -8, 0], scale: [1, 1.02, 1] }
            }
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Outer delicate orbital ring */}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 160 160"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="80"
                cy="80"
                r="72"
                stroke="url(#ringGradient)"
                strokeWidth="1.5"
                strokeDasharray="4 8"
                className="opacity-60"
              />
              <defs>
                <linearGradient id="ringGradient" x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7c5cff" />
                  <stop offset="0.5" stopColor="#5ee7e0" />
                  <stop offset="1" stopColor="#b47aff" />
                </linearGradient>
              </defs>
            </svg>

            {/* Inner soft luminescent orb representing life & consciousness */}
            <div
              className="relative flex h-24 w-24 items-center justify-center rounded-full sm:h-28 sm:w-28"
              style={{
                background: "radial-gradient(circle at 35% 35%, rgba(180, 122, 255, 0.95), rgba(124, 92, 255, 0.7) 60%, rgba(94, 231, 224, 0.4) 100%)",
                boxShadow: "0 0 45px rgba(124, 92, 255, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.4)",
              }}
            >
              {/* Subtle gentle twin light points (resembling attentive eyes/spark) */}
              <div className="flex gap-4">
                <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
                <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
              </div>
            </div>

            {/* Floating stardust motes */}
            {!prefersReducedMotion && (
              <>
                <motion.span
                  className="absolute -top-1 left-6 h-1.5 w-1.5 rounded-full bg-aurora/80"
                  animate={{ y: [0, -12, 0], opacity: [0.2, 0.9, 0.2] }}
                  transition={{ duration: 3.5, repeat: Infinity, delay: 0.2 }}
                />
                <motion.span
                  className="absolute bottom-4 -right-1 h-1.5 w-1.5 rounded-full bg-accent-gold/80"
                  animate={{ y: [0, -10, 0], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                />
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* 3. Luminous Ground Pedestal (where the companion rests/walks) */}
      <motion.div
        className="pointer-events-none mt-3 h-3 w-40 rounded-[100%] blur-sm sm:w-52"
        style={{
          background: "radial-gradient(ellipse at center, rgba(94, 231, 224, 0.6) 0%, rgba(124, 92, 255, 0.2) 60%, transparent 85%)",
        }}
        animate={
          prefersReducedMotion
            ? { opacity: 0.6 }
            : { scaleX: [0.92, 1.08, 0.92], opacity: [0.45, 0.75, 0.45] }
        }
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
    </div>
  );
}
