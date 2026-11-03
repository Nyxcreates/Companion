"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { WORLD_THEMES } from "@/lib/world/worldThemes";
import { LivingCompanionGuide } from "@/components/character/LivingCompanionGuide";
import type { AppTheme, LivingEnvironmentId } from "@/types/profile";

interface Scene06Props {
  initialTheme: AppTheme;
  initialEnvironment: LivingEnvironmentId;
  onEnterCompanion: (selectedTheme: AppTheme, selectedEnv: LivingEnvironmentId) => void;
  isSubmitting?: boolean;
  companionName?: string;
}

export function Scene06WorldGatewayDiscovery({
  initialTheme,
  initialEnvironment,
  onEnterCompanion,
  isSubmitting = false,
  companionName = "Nikki",
}: Scene06Props) {
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(initialTheme);
  const [selectedEnv, setSelectedEnv] = useState<LivingEnvironmentId>(initialEnvironment);

  const activeThemeMeta = WORLD_THEMES.find((w) => w.id === selectedEnv) ?? WORLD_THEMES[0];

  return (
    <div className="relative flex h-full min-h-[580px] w-full max-w-5xl flex-col justify-between px-4 sm:px-8">
      {/* Top Header & Selected World Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="text-center sm:text-left">
          <span className="font-mono text-xs uppercase tracking-widest text-cyan-300 font-semibold">
            ✦ Welcome Home
          </span>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Let&apos;s make this place yours.
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            Choose your starting living world and appearance. You can change these anytime in Settings.
          </p>
        </div>

        {/* Independent Light / Dark Appearance Toggle */}
        <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-900/80 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSelectedTheme("dark")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              selectedTheme === "dark"
                ? "bg-slate-800 text-white shadow-sm ring-1 ring-cyan-400"
                : "text-ink-muted hover:text-white"
            }`}
          >
            <span>🌙</span>
            <span>Dark</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedTheme("light")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              selectedTheme === "light"
                ? "bg-amber-100 text-slate-900 shadow-sm ring-1 ring-amber-500"
                : "text-ink-muted hover:text-white"
            }`}
          >
            <span>☀️</span>
            <span>Light</span>
          </button>
        </div>
      </div>

      {/* Center: 8 Living Worlds Grid Selector */}
      <div className="my-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {WORLD_THEMES.map((world) => {
            const isSelected = selectedEnv === world.id;
            return (
              <button
                key={world.id}
                type="button"
                onClick={() => setSelectedEnv(world.id)}
                className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-cyan-400 bg-slate-900/95 shadow-[0_0_15px_rgba(94,231,224,0.3)] ring-1 ring-cyan-400 scale-[1.02]"
                    : "border-white/10 bg-slate-900/60 hover:border-white/20 hover:bg-slate-900/80"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{world.icon}</span>
                    {isSelected && (
                      <span className="rounded-full bg-cyan-400/20 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-white truncate">{world.name}</p>
                  <p className="mt-0.5 text-[10px] text-ink-muted line-clamp-2 leading-relaxed">
                    {world.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Area: Guide Character & Final "Enter Your World" Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-3 border-t border-white/10">
        <div className="flex items-center gap-3">
          <LivingCompanionGuide
            pose="celebrate"
            gaze="center"
            name={companionName}
            className="scale-75 sm:scale-85"
          />
          <div className="text-left text-xs">
            <span className="font-semibold text-white">Your sanctuary is ready.</span>
            <p className="text-ink-secondary text-[11px]">
              Active world: <strong className="text-cyan-300">{activeThemeMeta.name}</strong> · {selectedTheme.toUpperCase()} mode.
            </p>
          </div>
        </div>

        {/* Enter Companion Primary Button */}
        <button
          type="button"
          onClick={() => onEnterCompanion(selectedTheme, selectedEnv)}
          disabled={isSubmitting}
          className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 px-8 py-3.5 text-base font-semibold text-white shadow-[0_0_25px_rgba(124,92,255,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_35px_rgba(94,231,224,0.5)] focus:outline-none focus:ring-2 focus:ring-cyan-400 active:scale-95 disabled:opacity-60"
        >
          <span>{isSubmitting ? "Entering..." : "Enter Your World"}</span>
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </button>
      </div>
    </div>
  );
}
