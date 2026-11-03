"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { LivingCompanionGuide } from "@/components/character/LivingCompanionGuide";

interface Scene01Props {
  onAdvance: () => void;
  companionName?: string;
}

export function Scene01AwakeningDiscovery({ onAdvance, companionName = "Nikki" }: Scene01Props) {
  const prefersReducedMotion = useReducedMotion();
  const [beaconAwakened, setBeaconAwakened] = useState(false);

  const handleBeaconClick = () => {
    setBeaconAwakened(true);
  };

  return (
    <div className="relative flex h-full min-h-[520px] w-full max-w-5xl items-center justify-between px-4 sm:px-8">
      {/* Left Area: Guide Character entering on celestial path */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative z-20 flex flex-col items-center sm:items-start"
      >
        <div className="flex flex-col items-center">
          <LivingCompanionGuide
            pose={beaconAwakened ? "celebrate" : "greet"}
            gaze="right"
            name={companionName}
            className="scale-95 sm:scale-105"
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-4 max-w-xs text-center sm:text-left rounded-xl border border-white/10 bg-slate-900/80 p-3.5 shadow-lg backdrop-blur-md"
          >
            <p className="font-display text-base font-medium text-white sm:text-lg">
              &ldquo;Hey, you&apos;re here.&rdquo;
            </p>
            <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
              Welcome to Companion. This is your personal space for everything you&apos;re becoming and everything you want to remember.
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Area: Focal Object — The Celestial Nexus Beacon */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.3 }}
        className="relative z-20 flex flex-col items-center sm:items-end"
      >
        <div className="relative flex flex-col items-center">
          {/* Interactive Celestial Beacon */}
          <button
            type="button"
            onClick={handleBeaconClick}
            className="group relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-full focus:outline-none"
            aria-label="Awaken the Celestial Beacon"
          >
            {/* Luminous Pulsing Rings */}
            <motion.div
              className="absolute inset-0 rounded-full blur-2xl transition-all duration-700"
              style={{
                background: beaconAwakened
                  ? "radial-gradient(circle, rgba(94, 231, 224, 0.5) 0%, rgba(124, 92, 255, 0.3) 60%, transparent 80%)"
                  : "radial-gradient(circle, rgba(124, 92, 255, 0.3) 0%, transparent 70%)",
              }}
              animate={
                prefersReducedMotion
                  ? {}
                  : { scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }
              }
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Concentric Energy Rings */}
            <svg viewBox="0 0 100 100" className="relative z-10 h-full w-full">
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                stroke="url(#beaconGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                fill="none"
                animate={prefersReducedMotion ? {} : { rotate: [0, 360] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              />
              <circle
                cx="50"
                cy="50"
                r="26"
                stroke="rgba(94, 231, 224, 0.4)"
                strokeWidth="1.2"
                fill="rgba(124, 92, 255, 0.15)"
              />
              <circle
                cx="50"
                cy="50"
                r="10"
                fill="#ffffff"
                className="drop-shadow-[0_0_12px_#5ee7e0]"
              />
              <defs>
                <linearGradient id="beaconGrad" x1="0" y1="0" x2="100" y2="100">
                  <stop stopColor="#5ee7e0" />
                  <stop offset="0.5" stopColor="#b47aff" />
                  <stop offset="1" stopColor="#ffd166" />
                </linearGradient>
              </defs>
            </svg>

            {!beaconAwakened && (
              <span className="absolute -bottom-7 whitespace-nowrap rounded-full border border-cyan-400/40 bg-slate-900/90 px-3 py-1 text-[11px] font-medium text-cyan-200 shadow-md backdrop-blur-md animate-bounce">
                ✦ Tap to awaken world
              </span>
            )}
          </button>

          {/* Contextual Feature Callout beside Beacon */}
          {beaconAwakened && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="mt-6 max-w-sm rounded-2xl border border-cyan-400/30 bg-slate-900/90 p-4 text-left shadow-xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <span className="font-mono text-xs uppercase tracking-wider text-cyan-300 font-semibold">
                  Discovery · The Living Sanctuary
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-primary font-medium">
                WHAT: An attentive companion space that remembers what matters to you.
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                WHY: No rigid alarms or corporate to-do lists. You grow at your own pace.
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={onAdvance}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-3 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 transition-colors"
                >
                  <span>Step forward</span>
                  <span>→</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
