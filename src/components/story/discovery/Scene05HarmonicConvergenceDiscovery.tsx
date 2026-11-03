"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { LivingCompanionGuide } from "@/components/character/LivingCompanionGuide";

interface Scene05Props {
  onAdvance: () => void;
  companionName?: string;
}

export function Scene05HarmonicConvergenceDiscovery({ onAdvance, companionName = "Nikki" }: Scene05Props) {
  const prefersReducedMotion = useReducedMotion();
  const [activeEssence, setActiveEssence] = useState<"memory" | "action" | "reflection">("action");

  return (
    <div className="relative flex h-full min-h-[520px] w-full max-w-4xl flex-col items-center justify-between px-4 sm:px-8">
      {/* Top Title Badge */}
      <div className="flex items-center gap-2 rounded-full border border-violet-400/30 bg-slate-900/80 px-3.5 py-1 backdrop-blur-md">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
        <span className="font-mono text-xs uppercase tracking-widest text-violet-200">
          The Living Convergence
        </span>
      </div>

      {/* Central Interactive Tri-Orb Nexus */}
      <div className="relative flex h-52 w-full max-w-md items-center justify-center my-4">
        {/* Ambient Halo */}
        <motion.div
          className="absolute inset-0 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(124, 92, 255, 0.25) 0%, rgba(94, 231, 224, 0.18) 50%, transparent 75%)",
          }}
          animate={prefersReducedMotion ? {} : { scale: [1, 1.1, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* 3 Orbital Realm Nodes */}
        <div className="relative z-10 flex items-center justify-center gap-8 sm:gap-12">
          {/* Node 1: Memory (Cosmos) */}
          <button
            type="button"
            onClick={() => setActiveEssence("memory")}
            className={`flex flex-col items-center gap-1.5 transition-all ${
              activeEssence === "memory" ? "scale-110" : "opacity-60 hover:opacity-100"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/50 bg-slate-900 shadow-[0_0_15px_rgba(94,231,224,0.4)]">
              <span className="text-xl">✦</span>
            </div>
            <span className="font-mono text-[11px] text-cyan-200 uppercase">Memories</span>
          </button>

          {/* Node 2: Action (Garden) */}
          <button
            type="button"
            onClick={() => setActiveEssence("action")}
            className={`flex flex-col items-center gap-1.5 transition-all ${
              activeEssence === "action" ? "scale-110" : "opacity-60 hover:opacity-100"
            }`}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/50 bg-slate-900 shadow-[0_0_20px_rgba(52,211,153,0.4)]">
              <span className="text-2xl">🌱</span>
            </div>
            <span className="font-mono text-[11px] text-emerald-200 uppercase">Goals & Plan</span>
          </button>

          {/* Node 3: Reflection (Ocean) */}
          <button
            type="button"
            onClick={() => setActiveEssence("reflection")}
            className={`flex flex-col items-center gap-1.5 transition-all ${
              activeEssence === "reflection" ? "scale-110" : "opacity-60 hover:opacity-100"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-teal-400/50 bg-slate-900 shadow-[0_0_15px_rgba(45,212,191,0.4)]">
              <span className="text-xl">🌊</span>
            </div>
            <span className="font-mono text-[11px] text-teal-200 uppercase">Focus & Calm</span>
          </button>
        </div>
      </div>

      {/* Narrative & Guide Character */}
      <div className="flex flex-col items-center text-center">
        <LivingCompanionGuide
          pose="ponder"
          gaze="center"
          name={companionName}
          className="scale-90 sm:scale-100"
        />

        <motion.div
          key={activeEssence}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 max-w-lg rounded-2xl border border-white/10 bg-slate-900/85 p-4 shadow-xl backdrop-blur-md"
        >
          <p className="font-display text-lg font-medium text-white sm:text-xl">
            &ldquo;Your life won&apos;t always follow the plan.&rdquo;
          </p>
          <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
            That&apos;s okay. We&apos;ll figure out the next step when we get there. This space is yours. You get to decide what matters, what you want to remember, and how you want to grow.
          </p>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 px-6 py-2 text-xs font-semibold text-white shadow-md hover:scale-105 transition-all"
            >
              <span>Choose Your Starting World</span>
              <span>→</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
