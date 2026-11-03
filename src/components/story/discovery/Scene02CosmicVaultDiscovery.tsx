"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { LivingCompanionGuide } from "@/components/character/LivingCompanionGuide";

interface Scene02Props {
  onAdvance: () => void;
  companionName?: string;
}

export function Scene02CosmicVaultDiscovery({ onAdvance, companionName = "Nikki" }: Scene02Props) {
  const prefersReducedMotion = useReducedMotion();
  const [activeFocal, setActiveFocal] = useState<"constellation" | "capsule">("constellation");
  const [capsuleOpened, setCapsuleOpened] = useState(false);
  const [demoMemoryAdded, setDemoMemoryAdded] = useState(false);

  return (
    <div className="relative flex h-full min-h-[540px] w-full max-w-5xl flex-col justify-between px-4 sm:px-8">
      {/* Top Interactive Horizon: Constellation (Left) and Memory Capsule (Right) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Left: The Memory Constellation */}
        <div
          onClick={() => setActiveFocal("constellation")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${
            activeFocal === "constellation"
              ? "border-cyan-400 bg-slate-900/90 shadow-[0_0_20px_rgba(94,231,224,0.25)]"
              : "border-white/10 bg-slate-900/50 hover:border-white/20"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs uppercase tracking-wider text-cyan-300 font-semibold">
              ✦ Constellation of Memories
            </span>
            <span className="text-[10px] text-ink-muted">Interactive</span>
          </div>

          <div className="relative h-28 w-60 sm:w-72">
            <svg viewBox="0 0 200 100" className="h-full w-full" fill="none">
              <motion.line
                x1="30"
                y1="70"
                x2="80"
                y2="30"
                stroke="#5ee7e0"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                animate={prefersReducedMotion ? {} : { strokeDashoffset: [0, -12] }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              />
              <motion.line
                x1="80"
                y1="30"
                x2="150"
                y2="50"
                stroke="#c084fc"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <circle cx="30" cy="70" r="4" fill="#ffffff" className="drop-shadow-[0_0_6px_#5ee7e0]" />
              <circle cx="80" cy="30" r="5" fill="#5ee7e0" className="drop-shadow-[0_0_8px_#5ee7e0]" />
              <circle cx="150" cy="50" r="4" fill="#ffd166" className="drop-shadow-[0_0_6px_#ffd166]" />

              <text x="24" y="88" fill="rgba(255,255,255,0.7)" fontSize="9" fontFamily="sans-serif">
                Habit
              </text>
              <text x="74" y="20" fill="#5ee7e0" fontSize="9" fontFamily="sans-serif">
                Goal Node
              </text>
              <text x="140" y="68" fill="rgba(255,255,255,0.7)" fontSize="9" fontFamily="sans-serif">
                Insight
              </text>
            </svg>
          </div>

          <p className="mt-1 text-xs text-ink-secondary">
            Nikki remembers recurring themes and promises you make to yourself.
          </p>
        </div>

        {/* Right: Floating Memory Capsule */}
        <div
          onClick={() => {
            setActiveFocal("capsule");
            setCapsuleOpened(true);
          }}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${
            activeFocal === "capsule"
              ? "border-violet-400 bg-slate-900/90 shadow-[0_0_20px_rgba(168,85,247,0.25)]"
              : "border-white/10 bg-slate-900/50 hover:border-white/20"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs uppercase tracking-wider text-violet-300 font-semibold">
              ✦ Memory Capsule
            </span>
            <span className="text-[10px] text-ink-muted">Tap to open</span>
          </div>

          <div className="relative flex h-28 w-60 sm:w-72 items-center justify-center">
            {/* Luminous Capsule Crystal */}
            <motion.div
              animate={prefersReducedMotion ? {} : { y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center gap-3"
            >
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/40 bg-violet-950/60 shadow-[0_0_15px_rgba(192,132,252,0.4)]">
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-violet-300" fill="none" stroke="currentColor">
                  <path strokeWidth="1.5" strokeLinecap="round" d="M12 2 L19 8 L19 16 L12 22 L5 16 L5 8 Z" />
                  <circle cx="12" cy="12" r="3" fill="#ffffff" />
                </svg>
              </div>

              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-white">
                  {capsuleOpened ? "Sealed Reflection #1" : "Locked Capsule"}
                </span>
                <span className="text-[11px] text-ink-muted">
                  {capsuleOpened ? "“Finished drafting chapter 1!”" : "Click to inspect contents"}
                </span>
              </div>
            </motion.div>
          </div>

          <p className="mt-1 text-xs text-ink-secondary">
            Time-locked reflections and heartfelt milestones you store for later.
          </p>
        </div>
      </div>

      {/* Middle/Bottom Area: Guide Character & Contextual Feature Breakdown */}
      <div className="mt-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
        {/* Guide Character */}
        <div className="flex items-center gap-4">
          <LivingCompanionGuide
            pose={activeFocal === "constellation" ? "point" : "ponder"}
            gaze={activeFocal === "constellation" ? "left" : "right"}
            name={companionName}
            className="scale-90 sm:scale-100"
          />

          <div className="max-w-xs text-left">
            <p className="font-display text-base font-medium text-white">
              &ldquo;Some things are worth carrying with you.&rdquo;
            </p>
            <p className="mt-1 text-xs text-ink-secondary">
              Nikki listens and keeps context across days—while you retain full control to view or delete memories at any moment.
            </p>
          </div>
        </div>

        {/* Feature Explainer Card (WHAT, WHY, HOW, WHERE) */}
        <div className="max-w-md rounded-2xl border border-white/15 bg-slate-900/90 p-4 text-left shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-mono text-xs uppercase tracking-wider text-cyan-300 font-semibold">
              Feature Guide · Memories
            </span>
            <span className="rounded-full bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 text-[10px] text-cyan-200">
              Where: /memories
            </span>
          </div>

          <div className="mt-2.5 flex flex-col gap-1.5 text-xs">
            <p>
              <strong className="text-white">WHAT:</strong> Conversations, Long-Term Memory, and Memory Capsules.
            </p>
            <p>
              <strong className="text-white">WHY:</strong> So you never have to re-explain yourself, and meaningful insights never get lost.
            </p>
            <p>
              <strong className="text-white">HOW:</strong> Automatic key-takeaway extraction with transparent review in your Memory Garden.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setDemoMemoryAdded(true)}
              className="text-[11px] text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              {demoMemoryAdded ? "✓ Sample memory linked" : "✦ Try test linking memory"}
            </button>

            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:scale-105 transition-all"
            >
              <span>Next: Goals & Growth</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
