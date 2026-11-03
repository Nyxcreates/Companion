"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { LivingCompanionGuide } from "@/components/character/LivingCompanionGuide";

interface Scene03Props {
  onAdvance: () => void;
  companionName?: string;
}

export function Scene03GardenGrowthDiscovery({ onAdvance, companionName = "Nikki" }: Scene03Props) {
  const prefersReducedMotion = useReducedMotion();
  const [growthStage, setGrowthStage] = useState<"seed" | "stem" | "full">("seed");

  return (
    <div className="relative flex h-full min-h-[540px] w-full max-w-5xl flex-col justify-between px-4 sm:px-8">
      {/* Top Section: The Interactive Living Growth Focal Area */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Left: The Growing Aspiration Tree */}
        <div className="flex-1 rounded-2xl border border-emerald-400/30 bg-slate-900/85 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-emerald-300 font-semibold">
              🌱 The Aspiration Tree
            </span>
            <span className="rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] text-emerald-200">
              Stage: {growthStage === "seed" ? "Aspiration Seed" : growthStage === "stem" ? "Active Goal" : "Actionable Tasks"}
            </span>
          </div>

          <div className="relative flex h-36 items-center justify-center">
            {/* Animated Plant SVG */}
            <svg viewBox="0 0 160 120" className="h-full w-48">
              {/* Soil Ground Line */}
              <line x1="10" y1="105" x2="150" y2="105" stroke="#059669" strokeWidth="2.5" strokeDasharray="3 3" />

              {/* Seed / Sprout */}
              {growthStage === "seed" && (
                <circle cx="80" cy="100" r="7" fill="#fbbf24" className="drop-shadow-[0_0_8px_#fbbf24]" />
              )}

              {/* Growing Stem */}
              {growthStage !== "seed" && (
                <motion.path
                  d="M80 105 Q78 65 80 40"
                  stroke="#34d399"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8 }}
                  fill="none"
                />
              )}

              {/* Blooming Goal Blossom (Stem level) */}
              {growthStage !== "seed" && (
                <g>
                  <circle cx="80" cy="35" r="9" fill="#fbbf24" className="drop-shadow-[0_0_8px_#fbbf24]" />
                  <circle cx="72" cy="28" r="5" fill="#f472b6" opacity="0.8" />
                  <circle cx="88" cy="28" r="5" fill="#f472b6" opacity="0.8" />
                  <circle cx="72" cy="42" r="5" fill="#f472b6" opacity="0.8" />
                  <circle cx="88" cy="42" r="5" fill="#f472b6" opacity="0.8" />
                </g>
              )}

              {/* Branching Task Leaves (Full stage) */}
              {growthStage === "full" && (
                <>
                  {/* Left Task Leaf */}
                  <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                    <path d="M78 75 Q50 65 55 50 Q70 55 78 72" fill="#10b981" />
                    <text x="18" y="55" fill="#34d399" fontSize="8" fontFamily="sans-serif">
                      Task 1: Outline
                    </text>
                  </motion.g>

                  {/* Right Task Leaf */}
                  <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 }}>
                    <path d="M82 60 Q110 50 105 35 Q90 40 82 57" fill="#10b981" />
                    <text x="110" y="42" fill="#34d399" fontSize="8" fontFamily="sans-serif">
                      Task 2: Draft 200w
                    </text>
                  </motion.g>
                </>
              )}
            </svg>
          </div>

          {/* Interactive Growth Demonstration Controls */}
          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setGrowthStage("stem")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                growthStage === "stem" || growthStage === "full"
                  ? "border border-emerald-400 bg-emerald-950/80 text-emerald-200"
                  : "border border-white/10 bg-slate-800 text-ink-muted hover:text-white"
              }`}
            >
              1. Plant Goal
            </button>
            <button
              type="button"
              onClick={() => setGrowthStage("full")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                growthStage === "full"
                  ? "border border-emerald-400 bg-emerald-950/80 text-emerald-200"
                  : "border border-white/10 bg-slate-800 text-ink-muted hover:text-white"
              }`}
            >
              2. Branch Daily Tasks
            </button>
          </div>
        </div>

        {/* Right: The Adaptive Timetable Flow */}
        <div className="flex-1 rounded-2xl border border-cyan-400/20 bg-slate-900/85 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-cyan-300 font-semibold">
              ✦ Adaptive Timetable
            </span>
            <span className="text-[10px] text-ink-muted">Guilt-free planning</span>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-white/5 p-2 border border-white/5">
              <span className="text-ink-secondary">09:00 - 10:30 AM</span>
              <span className="font-medium text-white">Deep Work: Task 1</span>
              <span className="text-emerald-400">✓ On track</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/5 p-2 border border-white/5">
              <span className="text-ink-secondary">02:00 - 03:00 PM</span>
              <span className="font-medium text-white">Daily Review</span>
              <span className="text-amber-400">Adaptive</span>
            </div>
          </div>

          <p className="mt-4 text-xs text-ink-secondary leading-relaxed">
            When your day doesn&apos;t go as planned, Nikki recalculates gently. No rigid red alarms—just realistic support.
          </p>
        </div>
      </div>

      {/* Bottom Area: Guide Character & Contextual Feature Guide */}
      <div className="mt-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <LivingCompanionGuide
            pose="point"
            gaze="left"
            name={companionName}
            className="scale-90 sm:scale-100"
          />

          <div className="max-w-xs text-left">
            <p className="font-display text-base font-medium text-white">
              &ldquo;Big things usually begin small.&rdquo;
            </p>
            <p className="mt-1 text-xs text-ink-secondary">
              A goal is what you&apos;re growing towards. Tasks are the quiet daily steps that make it real.
            </p>
          </div>
        </div>

        <div className="max-w-md rounded-2xl border border-white/15 bg-slate-900/90 p-4 text-left shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-mono text-xs uppercase tracking-wider text-emerald-300 font-semibold">
              Feature Guide · Plan
            </span>
            <span className="rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-200">
              Where: /plan
            </span>
          </div>

          <div className="mt-2.5 flex flex-col gap-1.5 text-xs">
            <p>
              <strong className="text-white">WHAT:</strong> Goal boards, prioritized Task lists, and daily Schedule timetable.
            </p>
            <p>
              <strong className="text-white">WHY:</strong> Gives shape to your dreams without the anxiety of rigid time-blocking.
            </p>
            <p>
              <strong className="text-white">HOW:</strong> Create goals, attach actionable tasks, and let Nikki arrange realistic schedule slots.
            </p>
          </div>

          <div className="mt-4 flex justify-end pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:scale-105 transition-all"
            >
              <span>Next: Focus & Reflection</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
