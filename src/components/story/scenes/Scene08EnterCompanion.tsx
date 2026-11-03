"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Scene08Props {
  onEnter: () => void;
  onReplay: () => void;
  isEntering?: boolean;
}

export function Scene08EnterCompanion({
  onEnter,
  onReplay,
  isEntering = false,
}: Scene08Props) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Radiant converging light emblem */}
      <motion.div
        className="relative mb-8 flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      >
        {/* Converging radiant glow */}
        <motion.div
          className="absolute inset-0 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(124, 92, 255, 0.45) 0%, rgba(94, 231, 224, 0.35) 45%, rgba(255, 209, 102, 0.2) 70%, transparent 85%)",
          }}
          animate={
            prefersReducedMotion
              ? {}
              : { scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }
          }
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Central Gateway Symbol */}
        <svg viewBox="0 0 100 100" className="relative z-10 h-24 w-24 sm:h-28 sm:w-28" fill="none">
          <motion.circle
            cx="50"
            cy="50"
            r="40"
            stroke="url(#gatewayGlow)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            animate={prefersReducedMotion ? {} : { rotate: [0, 360] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
          <motion.polygon
            points="50,15 80,75 20,75"
            stroke="url(#gatewayGlow)"
            strokeWidth="1.5"
            fill="rgba(124, 92, 255, 0.15)"
            animate={prefersReducedMotion ? {} : { rotate: [0, -360] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />
          <circle cx="50" cy="50" r="5" fill="#ffffff" className="drop-shadow-[0_0_12px_#ffffff]" />
          <defs>
            <linearGradient id="gatewayGlow" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffd166" />
              <stop offset="0.5" stopColor="#5ee7e0" />
              <stop offset="1" stopColor="#b47aff" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      {/* Culmination Text */}
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.p
          className="font-display text-lg tracking-widest uppercase text-cyan-300"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2 }}
        >
          Your Next Chapter
        </motion.p>

        <motion.p
          className="font-display text-2xl font-light tracking-wide text-ink-primary sm:text-3xl md:text-5xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.4 }}
        >
          &ldquo;Your journey doesn&apos;t start with perfection.&rdquo;
        </motion.p>

        <motion.p
          className="font-display text-xl font-light text-ink-secondary sm:text-2xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
        >
          It starts with showing up.
        </motion.p>

        <motion.h1
          className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
        >
          Welcome to{" "}
          <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-amber-200 bg-clip-text text-transparent">
            Companion
          </span>
        </motion.h1>

        {/* Action Buttons: Enter Companion & Replay */}
        <motion.div
          className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <button
            type="button"
            onClick={onEnter}
            disabled={isEntering}
            className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 px-8 py-3.5 text-base font-semibold text-white shadow-[0_0_25px_rgba(124,92,255,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_35px_rgba(94,231,224,0.5)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-95 disabled:opacity-60"
            aria-label="Enter Companion Application"
          >
            <span>{isEntering ? "Entering..." : "Enter Companion"}</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>

          <button
            type="button"
            onClick={onReplay}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink-primary focus:outline-none focus:ring-1 focus:ring-violet-400"
            aria-label="Replay Opening Story"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            <span>Replay Story</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
