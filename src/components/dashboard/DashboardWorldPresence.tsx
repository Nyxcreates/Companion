"use client";

import Link from "next/link";
import { useProfile } from "@/context/ProfileContext";
import { useWorldTheme } from "@/context/WorldThemeContext";
import { WORLD_THEMES, normalizeLivingEnvironmentId } from "@/lib/world/worldThemes";
import { LivingCompanionGuide } from "@/components/character/LivingCompanionGuide";

export function DashboardWorldPresence() {
  const { profile } = useProfile();
  const { livingEnvironment } = useWorldTheme();

  const companionName = profile?.companionName ?? "Nikki";
  const userName = profile?.displayName ? `, ${profile.displayName}` : "";

  const canonicalEnv = normalizeLivingEnvironmentId(livingEnvironment);
  const themeMeta = WORLD_THEMES.find((w) => w.id === canonicalEnv) ?? WORLD_THEMES[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-5 shadow-lg backdrop-blur-xl sm:p-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        {/* Living Guide Miniature */}
        <div className="flex-shrink-0">
          <LivingCompanionGuide
            pose="idle"
            gaze="center"
            name={companionName}
            className="scale-90"
          />
        </div>

        {/* Welcoming Message & Living World Status */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-display text-lg font-semibold text-white">
              Welcome back{userName}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-ink-secondary">
              <span>{themeMeta.icon}</span>
              <span>{themeMeta.name}</span>
            </span>
          </div>

          <p className="mt-1 text-sm text-ink-secondary">
            {companionName} is here with you. Whether you want to plan your next steps, enter focus, or simply chat through what&apos;s on your mind—this space adapts to your pace.
          </p>

          {/* Quick World Portals */}
          <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <Link
              href="/plan"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-800/60 px-3 py-1 text-xs text-ink-secondary transition-colors hover:border-cyan-400/40 hover:text-white"
            >
              <span>◈</span>
              <span>Plan Today</span>
            </Link>
            <Link
              href="/focus"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-800/60 px-3 py-1 text-xs text-ink-secondary transition-colors hover:border-teal-400/40 hover:text-white"
            >
              <span>⏱</span>
              <span>Focus Mode</span>
            </Link>
            <Link
              href="/journal"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-800/60 px-3 py-1 text-xs text-ink-secondary transition-colors hover:border-pink-400/40 hover:text-white"
            >
              <span>✍</span>
              <span>Journal</span>
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-800/60 px-3 py-1 text-xs text-ink-secondary transition-colors hover:border-amber-400/40 hover:text-white"
            >
              <span>⚙</span>
              <span>Customize World</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
