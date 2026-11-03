"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { LivingCompanionGuide } from "@/components/character/LivingCompanionGuide";

interface Scene04Props {
  onAdvance: () => void;
  companionName?: string;
}

export function Scene04AbyssalSanctuaryDiscovery({ onAdvance, companionName = "Nikki" }: Scene04Props) {
  const prefersReducedMotion = useReducedMotion();
  const [breathActive, setBreathActive] = useState(false);
  const [breathCountdown, setBreathCountdown] = useState(10);
  const [journalOpen, setJournalOpen] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (breathActive && breathCountdown > 0) {
      timer = setTimeout(() => {
        setBreathCountdown((c) => c - 1);
      }, 1000);
    } else if (breathCountdown === 0) {
      setBreathActive(false);
      setBreathCountdown(10);
    }
    return () => clearTimeout(timer);
  }, [breathActive, breathCountdown]);

  return (
    <div className="relative flex h-full min-h-[540px] w-full max-w-5xl flex-col justify-between px-4 sm:px-8">
      {/* Top Section: Focus Sanctuary (Right) & Reflective Journal (Left) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Left: Reflective Pearl Shell (Journal) */}
        <div
          onClick={() => setJournalOpen(true)}
          className="flex-1 cursor-pointer rounded-2xl border border-pink-400/30 bg-slate-900/85 p-5 shadow-xl backdrop-blur-xl transition-all hover:border-pink-400/50"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-pink-300 font-semibold">
              ✦ Reflective Journal
            </span>
            <span className="text-[10px] text-ink-muted">Tap to inspect</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-950/50 border border-pink-500/30">
              <svg viewBox="0 0 40 30" className="h-8 w-10 text-pink-300">
                <path d="M5 25 C5 10 35 10 35 25 Z" fill="currentColor" opacity="0.6" />
                <circle cx="20" cy="18" r="4.5" fill="#ffffff" className="drop-shadow-[0_0_8px_#f472b6]" />
              </svg>
            </div>

            <div className="flex flex-col text-left text-xs">
              <span className="font-medium text-white">
                {journalOpen ? "“What brought you peace today?”" : "Personal Evening Sanctuary"}
              </span>
              <p className="mt-1 text-ink-secondary">
                {journalOpen
                  ? "Writing untangles mental clutter before sleep."
                  : "Click to reveal a sample reflection prompt."}
              </p>
            </div>
          </div>
        </div>

        {/* Right: The Bioluminescent Focus Sanctuary */}
        <div className="flex-1 rounded-2xl border border-teal-400/30 bg-slate-900/85 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-xs uppercase tracking-wider text-teal-300 font-semibold">
              ⏱ Focus Mode Sanctuary
            </span>
            <span className="rounded-full bg-teal-950/60 border border-teal-500/30 px-2 py-0.5 text-[10px] text-teal-200">
              {breathActive ? `${breathCountdown}s Breathing` : "Calm timer"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Interactive Breathing Orb */}
            <motion.div
              className="relative flex h-16 w-16 items-center justify-center rounded-full border border-teal-300/40 bg-teal-950/60"
              animate={
                breathActive
                  ? { scale: [1, 1.25, 1], boxShadow: ["0 0 10px #2dd4bf", "0 0 25px #2dd4bf", "0 0 10px #2dd4bf"] }
                  : { scale: 1 }
              }
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="font-mono text-sm font-bold text-white">
                {breathActive ? breathCountdown : "25m"}
              </span>
            </motion.div>

            <div className="flex flex-col text-left text-xs flex-1">
              <span className="font-medium text-white">Distraction-free Sessions</span>
              <p className="mt-1 text-ink-secondary">
                Timer sessions that automatically silence background noise.
              </p>
              <button
                type="button"
                onClick={() => setBreathActive(true)}
                className="mt-2 self-start rounded-full bg-teal-500/20 border border-teal-400/40 px-2.5 py-0.5 text-[11px] font-medium text-teal-200 hover:bg-teal-500/30 transition-colors"
              >
                {breathActive ? "Breathe gently..." : "✦ Try 10-Second Breath"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Area: Guide Character & Feature Explainer */}
      <div className="mt-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <LivingCompanionGuide
            pose="ponder"
            gaze="right"
            name={companionName}
            className="scale-90 sm:scale-100"
          />

          <div className="max-w-xs text-left">
            <p className="font-display text-base font-medium text-white">
              &ldquo;Sometimes, you don&apos;t need to do more.&rdquo;
            </p>
            <p className="mt-1 text-xs text-ink-secondary">
              Sometimes you just need quiet space to focus, or a safe place to untangle what&apos;s on your mind.
            </p>
          </div>
        </div>

        <div className="max-w-md rounded-2xl border border-white/15 bg-slate-900/90 p-4 text-left shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-mono text-xs uppercase tracking-wider text-teal-300 font-semibold">
              Feature Guide · Focus & Journal
            </span>
            <span className="rounded-full bg-teal-950/60 border border-teal-500/30 px-2 py-0.5 text-[10px] text-teal-200">
              Where: /focus · /journal
            </span>
          </div>

          <div className="mt-2.5 flex flex-col gap-1.5 text-xs">
            <p>
              <strong className="text-white">WHAT:</strong> Active focus timers with task association and private journal boards.
            </p>
            <p>
              <strong className="text-white">WHY:</strong> Reclaims your attention from constant digital distractions.
            </p>
            <p>
              <strong className="text-white">HOW:</strong> Single-task timer sessions and unhurried reflections grouped by date.
            </p>
          </div>

          <div className="mt-4 flex justify-end pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:scale-105 transition-all"
            >
              <span>Next: Unified World</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
