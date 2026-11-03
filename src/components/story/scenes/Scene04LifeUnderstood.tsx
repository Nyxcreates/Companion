"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Scene04Props {
  currentBlockIndex: number;
}

export function Scene04LifeUnderstood({ currentBlockIndex }: Scene04Props) {
  const prefersReducedMotion = useReducedMotion();

  const sampleMemories = [
    { text: "Writing project milestone", category: "Goal", delay: 0.3, x: -75, y: -25 },
    { text: "Morning mindfulness habit", category: "Habit", delay: 0.6, x: 80, y: -35 },
    { text: "Walk outside when overwhelmed", category: "Insight", delay: 0.9, x: -60, y: 35 },
    { text: "Revisiting deep focus at 9am", category: "Preference", delay: 1.2, x: 70, y: 30 },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Central Memory Sphere & Memory Fragments */}
      <div className="relative mb-6 flex h-48 w-full max-w-lg items-center justify-center sm:h-56">
        {/* Memory Aura */}
        <motion.div
          className="absolute h-36 w-36 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, rgba(94, 231, 224, 0.2) 60%, transparent 80%)" }}
          animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Central Luminous Memory Capsule */}
        <motion.div
          className="relative z-10 flex h-24 w-24 items-center justify-center rounded-2xl border border-purple-400/30 bg-slate-900/60 shadow-[0_0_30px_rgba(168,85,247,0.35)] backdrop-blur-xl sm:h-28 sm:w-28"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2 }}
        >
          {/* Inner crystal animation */}
          <svg viewBox="0 0 60 60" className="h-14 w-14" fill="none">
            <motion.polygon
              points="30,8 50,20 50,42 30,52 10,42 10,20"
              stroke="url(#capsuleGrad)"
              strokeWidth="1.5"
              fill="rgba(168, 85, 247, 0.12)"
              animate={prefersReducedMotion ? {} : { rotate: [0, 360] }}
              transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            />
            <circle cx="30" cy="30" r="5" fill="#ffffff" className="drop-shadow-[0_0_8px_#5ee7e0]" />
            <defs>
              <linearGradient id="capsuleGrad" x1="10" y1="8" x2="50" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#5ee7e0" />
                <stop offset="0.5" stopColor="#c084fc" />
                <stop offset="1" stopColor="#f472b6" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        {/* Floating Memory Badges */}
        {sampleMemories.map((item, idx) => (
          <motion.div
            key={idx}
            className="absolute hidden sm:flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-slate-900/80 px-3 py-1 text-xs text-ink-primary shadow-lg backdrop-blur-md"
            style={{
              transform: `translate(${item.x * 2.2}px, ${item.y * 1.5}px)`,
            }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 0.9, scale: 1 }}
            transition={{ duration: 0.9, delay: item.delay }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span className="font-mono text-[10px] text-cyan-300 uppercase">{item.category}</span>
            <span className="text-ink-secondary">·</span>
            <span>{item.text}</span>
          </motion.div>
        ))}

        {/* Mobile-friendly tag row */}
        <div className="absolute -bottom-2 flex sm:hidden gap-1.5 overflow-hidden">
          <span className="rounded-full border border-violet-500/30 bg-slate-900/80 px-2 py-0.5 text-[10px] text-violet-200">
            ✦ Goals remembered
          </span>
          <span className="rounded-full border border-cyan-500/30 bg-slate-900/80 px-2 py-0.5 text-[10px] text-cyan-200">
            ✦ You hold the keys
          </span>
        </div>
      </div>

      {/* Narrative Copy */}
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.p
          className="font-display text-2xl font-light tracking-wide text-ink-primary sm:text-3xl md:text-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.2 }}
        >
          &ldquo;A companion who listens.&rdquo;
        </motion.p>

        <motion.p
          className="max-w-xl text-base text-ink-secondary sm:text-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
        >
          Nikki remembers the things that matter to you—your ambitions, daily rhythms, and the promises you make to yourself.
        </motion.p>

        {currentBlockIndex >= 1 && (
          <motion.div
            className="mt-2 flex flex-col items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="max-w-md text-sm text-ink-muted">
              Every conversation helps her understand how to support you better, with total privacy and complete control over what is kept.
            </p>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-3 py-0.5 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Private · Transparent · Editable by you
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
