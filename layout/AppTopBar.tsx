"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Smartphone, Play, Square } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useUsage } from "@/context/UsageContext";
import { useWorldTheme } from "@/context/WorldThemeContext";
import { WORLD_THEMES, normalizeLivingEnvironmentId } from "@/lib/world/worldThemes";
import { CharacterPlaceholder } from "@/components/character/CharacterPlaceholder";

function formatTimer(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AppTopBar() {
  const { isDistractionTimerRunning, distractionTimerSeconds, stopDistractionTimer } = useUsage();
  const { livingEnvironment } = useWorldTheme();

  const canonicalEnv = normalizeLivingEnvironmentId(livingEnvironment);
  const currentTheme = WORLD_THEMES.find((w) => w.id === canonicalEnv) ?? WORLD_THEMES[0];

  return (
    <header className="sticky top-0 z-30 mb-4 flex items-center justify-between border-b border-white/10 bg-slate-950/40 px-4 py-3 backdrop-blur-md md:rounded-2xl md:border md:mb-6">
      {/* Mobile Branding (hidden on desktop because Sidebar already shows it) */}
      <div className="flex items-center gap-2 md:hidden">
        <CharacterPlaceholder size={30} />
        <span className="font-display font-semibold text-sm text-ink-primary">Companion</span>
      </div>

      {/* World Theme indicator */}
      <div className="hidden md:flex items-center gap-2">
        <Link
          href="/settings#appearance"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-ink-muted hover:text-white transition-colors"
          title="World Atmosphere"
        >
          <span>{currentTheme.icon}</span>
          <span className="font-medium text-ink-secondary">{currentTheme.name}</span>
        </Link>
      </div>

      {/* Right side items: Phone timer pill + Notification Bell */}
      <div className="flex items-center gap-2.5">
        {isDistractionTimerRunning ? (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            <Smartphone className="h-3.5 w-3.5 animate-pulse" />
            <span className="font-mono font-semibold">{formatTimer(distractionTimerSeconds)}</span>
            <button
              type="button"
              onClick={() => stopDistractionTimer()}
              className="ml-1 text-[10px] uppercase font-bold text-emerald-400 hover:text-white underline"
            >
              Stop
            </button>
          </div>
        ) : (
          <Link
            href="/dashboard#phone-usage"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-ink-muted hover:text-white transition-colors"
          >
            <Smartphone className="h-3 w-3 text-purple-400" />
            <span>Phone Balance</span>
          </Link>
        )}

        {/* The Notification Bell */}
        <NotificationBell />
      </div>
    </header>
  );
}

