"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Scene01Props {
  currentBlockIndex: number;
}

export function Scene01TheBeginning({ currentBlockIndex }: Scene01Props) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Central emerging celestial spark / emblem */}
      <motion.div
        className="relative mb-8 flex h-28 w-28 items-center justify-center sm:h-36 sm:w-36"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Soft aura */}
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(124,92,255,0.45) 0%, transparent 70%)" }}
          animate={
            prefersReducedMotion
              ? {}
              : { scale: [1, 1.15, 1], opacity: [0.4, 0.75, 0.4] }
          }
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Delicate golden/cyan star emblem */}
        <svg viewBox="0 0 100 100" className="relative z-10 h-20 w-20 sm:h-24 sm:w-24" fill="none">
          <circle cx="50" cy="50" r="32" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 5" />
          <motion.path
            d="M50 16 L54 44 L82 50 L54 56 L50 84 L46 56 L18 50 L46 44 Z"
            fill="url(#starGlow)"
            animate={prefersReducedMotion ? {} : { rotate: [0, 5, -5, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <circle cx="50" cy="50" r="4" fill="#ffffff" className="shadow-[0_0_12px_#ffffff]" />
          <defs>
            <linearGradient id="starGlow" x1="18" y1="16" x2="82" y2="84" gradientUnits="userSpaceOnUse">
              <stop stopColor="#b47aff" />
              <stop offset="0.5" stopColor="#5ee7e0" />
              <stop offset="1" stopColor="#ffd166" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      {/* Atmospheric text reveal */}
      <div className="flex flex-col items-center gap-4 text-center">
        <motion.p
          className="font-display text-2xl font-light tracking-wide text-ink-primary sm:text-3xl md:text-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.3 }}
        >
          Somewhere between who you are...
        </motion.p>

        <motion.p
          className="font-display text-xl font-light text-ink-secondary sm:text-2xl md:text-3xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 1.6 }}
        >
          ...and who you&apos;re becoming...
        </motion.p>

        {currentBlockIndex >= 1 && (
          <motion.p
            className="mt-4 font-display text-lg font-medium text-aurora sm:text-xl md:text-2xl"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4, delay: 0.4 }}
          >
            There is a space that belongs to you.
          </motion.p>
        )}
      </div>
    </div>
  );
}
