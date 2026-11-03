"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Scene06Props {
  currentBlockIndex: number;
}

export function Scene06SpaceToBeginAgain({ currentBlockIndex }: Scene06Props) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Meditative Breathing Orb & Ambient Rings */}
      <div className="relative mb-6 flex h-48 w-full max-w-sm items-center justify-center sm:h-56">
        {/* Soft undulating water / focus ripples */}
        {[1, 2, 3].map((ring) => (
          <motion.div
            key={`ring-${ring}`}
            className="absolute rounded-full border border-teal-400/20"
            style={{ width: `${ring * 65}px`, height: `${ring * 65}px` }}
            animate={
              prefersReducedMotion
                ? {}
                : {
                    scale: [0.95, 1.25, 0.95],
                    opacity: [0.2, 0.5, 0.2],
                  }
            }
            transition={{
              duration: 5,
              delay: ring * 1.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Central Breathing Orb */}
        <motion.div
          className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-teal-300/40 shadow-[0_0_40px_rgba(45,212,191,0.35)] backdrop-blur-md sm:h-28 sm:w-28"
          style={{
            background: "radial-gradient(circle, rgba(45,212,191,0.25) 0%, rgba(15,23,42,0.8) 75%)",
          }}
          animate={
            prefersReducedMotion
              ? {}
              : {
                  scale: [1, 1.18, 1],
                  boxShadow: [
                    "0 0 25px rgba(45,212,191,0.25)",
                    "0 0 55px rgba(45,212,191,0.5)",
                    "0 0 25px rgba(45,212,191,0.25)",
                  ],
                }
          }
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Subtle icon: water droplet / ink quill */}
          <svg viewBox="0 0 40 40" className="h-10 w-10 text-teal-200" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M20 5 C20 5 10 18 10 25 C10 30.5 14.5 35 20 35 C25.5 35 30 30.5 30 25 C30 18 20 5 20 5 Z"
            />
            <circle cx="20" cy="27" r="2.5" fill="currentColor" opacity="0.6" />
          </svg>
        </motion.div>

        {/* Breathing guide label */}
        <motion.div
          className="pointer-events-none absolute bottom-0 font-mono text-[11px] tracking-widest uppercase text-teal-300/70"
          animate={prefersReducedMotion ? {} : { opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          Breathe In · Find Stillness
        </motion.div>
      </div>

      {/* Narrative Text */}
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.p
          className="font-display text-2xl font-light tracking-wide text-ink-primary sm:text-3xl md:text-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.2 }}
        >
          &ldquo;When the world is too loud...&rdquo;
        </motion.p>

        <motion.p
          className="font-display text-xl font-light text-teal-300 sm:text-2xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          ...find your focus.
        </motion.p>

        <motion.p
          className="max-w-xl text-base text-ink-secondary sm:text-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.7 }}
        >
          Journal your thoughts. Clear your mind. Reset your day. Every morning is a clean canvas, and every pause is an invitation to begin again.
        </motion.p>

        {currentBlockIndex >= 1 && (
          <motion.div
            className="mt-3 flex flex-wrap items-center justify-center gap-2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-3 py-0.5 text-xs text-teal-300">
              ✦ Focus Timer & Ambiance
            </span>
            <span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-3 py-0.5 text-xs text-teal-300">
              ✦ Reflective Journal
            </span>
            <span className="rounded-full border border-teal-500/30 bg-teal-950/40 px-3 py-0.5 text-xs text-teal-300">
              ✦ Zero notifications mode
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
