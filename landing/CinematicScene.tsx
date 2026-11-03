"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import clsx from "clsx";

interface CinematicSceneProps {
  children: ReactNode;
  background?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * Shared cinematic frame. Background and content drift together under
 * one very slow, very subtle camera float, so the environment and the
 * Companion always feel like they belong to the same space — depth
 * inside the environment comes from SpaceScene's own layered motion
 * and pointer parallax, not from separating background and foreground
 * here.
 */
export function CinematicScene({ children, background, className, ariaLabel }: CinematicSceneProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role={ariaLabel ? "region" : undefined}
      aria-label={ariaLabel}
      className={clsx("relative overflow-hidden bg-surface-primary", className)}
    >
      <motion.div
        className="absolute inset-0"
        animate={prefersReducedMotion ? {} : { x: [0, 5, -4, 0], y: [0, -3, 3, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      >
        {background && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {background}
          </div>
        )}
        <div className="relative">{children}</div>
      </motion.div>
    </div>
  );
}