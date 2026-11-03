"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Scene05Props {
  currentBlockIndex: number;
}

export function Scene05DreamsBecomeSteps({ currentBlockIndex }: Scene05Props) {
  const prefersReducedMotion = useReducedMotion();

  const steps = [
    {
      level: "Aspiration",
      title: "Write my first book",
      badge: "Long-term Goal",
      color: "border-amber-400/40 bg-amber-950/30 text-amber-300",
      icon: "★",
    },
    {
      level: "Milestone",
      title: "Outline 12 chapters",
      badge: "Target Milestone",
      color: "border-purple-400/40 bg-purple-950/30 text-purple-300",
      icon: "◈",
    },
    {
      level: "Today's Step",
      title: "Write 300 words · 10:00 AM",
      badge: "Today's Schedule",
      color: "border-cyan-400/40 bg-cyan-950/30 text-cyan-300",
      icon: "✓",
    },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Visual Pathway: Aspiration -> Milestone -> Daily Step */}
      <div className="relative mb-6 flex w-full max-w-lg flex-col items-center">
        {/* Glow behind pathway */}
        <motion.div
          className="absolute inset-0 rounded-3xl blur-2xl"
          style={{ background: "radial-gradient(ellipse at center, rgba(14, 165, 233, 0.18) 0%, rgba(99, 102, 241, 0.12) 60%, transparent 80%)" }}
          animate={prefersReducedMotion ? {} : { opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Step cards stacked with connecting illuminated line */}
        <div className="relative z-10 flex w-full flex-col gap-2.5 sm:gap-3">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              className={`flex items-center justify-between rounded-xl border p-3 shadow-md backdrop-blur-md sm:px-4 sm:py-3 ${step.color}`}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.15 + idx * 0.2 }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 font-mono text-sm font-bold">
                  {step.icon}
                </span>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
                    {step.level}
                  </span>
                  <p className="text-sm font-medium text-ink-primary sm:text-base">
                    {step.title}
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs text-ink-secondary">
                {step.badge}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Adaptive Re-planning Tag */}
        <motion.div
          className="relative z-10 mt-3 flex items-center gap-2 rounded-full border border-violet-500/30 bg-slate-900/90 px-3.5 py-1 text-xs text-violet-200 backdrop-blur-md"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.8 }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
          <span>Life shifts? Nikki recalculates without pressure or guilt.</span>
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
          &ldquo;Big dreams are built from small, quiet steps.&rdquo;
        </motion.p>

        <motion.p
          className="max-w-xl text-base text-ink-secondary sm:text-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
        >
          Organize your day without the anxiety of rigid schedules. Set goals that reflect what you truly care about, and let the path reveal itself.
        </motion.p>

        {currentBlockIndex >= 1 && (
          <motion.p
            className="max-w-md text-sm text-ink-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            Goals connect to tasks. Tasks flow into your timetable. And when unexpected days happen, Nikki helps you adapt seamlessly.
          </motion.p>
        )}
      </div>
    </div>
  );
}
