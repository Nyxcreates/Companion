"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { scaleIn } from "@/lib/motion";

/**
 * Reusable speech bubble for any scene the Companion speaks in.
 * Styled to feel like part of the world (dark, glowing, translucent)
 * rather than a standard UI tooltip.
 */
export function SpeechBubble({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative max-w-[18rem] break-words rounded-2xl border border-white/10 bg-surface-elevated/85 px-6 py-3 text-center font-display text-base text-ink-primary shadow-glow backdrop-blur-md"
    >
      {children}
      <span
        aria-hidden="true"
        className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-white/10 bg-surface-elevated/85"
      />
    </motion.div>
  );
}