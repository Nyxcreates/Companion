"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Scene02Props {
  currentBlockIndex: number;
}

const FLOATING_FRAGMENTS = [
  { text: "100 unfinished ideas", x: -140, y: -60, rotate: -4, delay: 0.1 },
  { text: "Where do I start?", x: 130, y: -80, rotate: 5, delay: 0.3 },
  { text: "Plans change", x: -110, y: 70, rotate: 3, delay: 0.5 },
  { text: "Finding my rhythm", x: 120, y: 60, rotate: -3, delay: 0.7 },
];

export function Scene02RealityOfLife({ currentBlockIndex }: Scene02Props) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Floating Translucent Thought Fragments */}
      <div className="pointer-events-none absolute -inset-24 overflow-hidden sm:-inset-32" aria-hidden="true">
        {FLOATING_FRAGMENTS.map((item, idx) => (
          <motion.div
            key={idx}
            className="absolute left-1/2 top-1/2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-1.5 backdrop-blur-md"
            style={{
              translateX: `calc(-50% + ${item.x}px)`,
              translateY: `calc(-50% + ${item.y}px)`,
              rotate: item.rotate,
            }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={
              prefersReducedMotion
                ? { opacity: 0.6 }
                : {
                    opacity: [0.35, 0.65, 0.35],
                    y: [0, idx % 2 === 0 ? -8 : 8, 0],
                  }
            }
            transition={{
              opacity: { duration: 1.2, delay: item.delay },
              y: { duration: 5 + idx, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <span className="text-xs font-light text-ink-muted sm:text-sm">{item.text}</span>
          </motion.div>
        ))}
      </div>

      {/* Narrative Text */}
      <div className="relative z-10 flex max-w-xl flex-col items-center gap-4 text-center">
        <motion.p
          className="font-display text-2xl font-light text-ink-primary sm:text-3xl md:text-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          Life doesn&apos;t always follow a plan.
        </motion.p>

        {currentBlockIndex >= 1 && (
          <motion.div
            className="flex flex-col gap-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <p className="font-display text-lg text-ink-secondary sm:text-xl md:text-2xl">
              Some days, you have a hundred dreams.
            </p>
            <p className="font-display text-lg text-ink-secondary sm:text-xl md:text-2xl">
              Some days, finding your next step is enough.
            </p>
          </motion.div>
        )}

        {currentBlockIndex >= 2 && (
          <motion.p
            className="mt-4 font-display text-xl font-medium text-accent-secondary sm:text-2xl md:text-3xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2 }}
          >
            You&apos;re allowed to grow at your own pace.
          </motion.p>
        )}
      </div>
    </div>
  );
}
