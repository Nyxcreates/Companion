"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { breathing } from "@/lib/motion";

interface CharacterPlaceholderProps {
  size?: number;
  className?: string;
}

export function CharacterPlaceholder({ size = 96, className }: CharacterPlaceholderProps) {
  return (
    <motion.div
      className={clsx("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      animate={{ scale: [1, 1.03, 1] }}
      transition={breathing}
      aria-label="Your companion"
      role="img"
    >
      <div
        className="absolute inset-0 rounded-full opacity-60 blur-xl"
        style={{ background: "radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)" }}
      />
      <svg viewBox="0 0 100 100" width={size} height={size} className="relative">
        <circle cx="50" cy="50" r="42" fill="var(--accent-primary)" opacity="0.85" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent-secondary)" strokeWidth="1.5" opacity="0.4" />
        <circle cx="38" cy="46" r="4" fill="var(--text-primary)" />
        <circle cx="62" cy="46" r="4" fill="var(--text-primary)" />
        <path d="M40 60 Q50 68 60 60" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    </motion.div>
  );
}