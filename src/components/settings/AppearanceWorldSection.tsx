"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useWorldTheme } from "@/context/WorldThemeContext";
import { useSoundtrack } from "@/context/SoundtrackContext";
import { useToast } from "@/context/ToastContext";
import { WORLD_THEMES, normalizeLivingEnvironmentId } from "@/lib/world/worldThemes";
import { getWorldPersonality } from "@/lib/worlds/personality";
import { LivingWorldBackdrop } from "@/components/world/LivingWorldBackdrop";
import { LivingCompanionGuide } from "@/components/character/LivingCompanionGuide";
import { Volume2, VolumeX, Music, Sparkles } from "lucide-react";
import type { AppTheme, LivingEnvironmentId } from "@/types/profile";
import type { AudioTrackId } from "@/lib/audio/soundtrack";

export function AppearanceWorldSection() {
  const router = useRouter();
  const { theme, livingEnvironment, activeReaction, setTheme, setLivingEnvironment } = useWorldTheme();
  const { isMuted, volume, activeTrack, toggleMute, setVolume, playTrack } = useSoundtrack();
  const { showToast } = useToast();

  const canonicalActiveEnv = normalizeLivingEnvironmentId(livingEnvironment);
  const [previewEnv, setPreviewEnv] = useState<LivingEnvironmentId | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const activeEnvForPreview = previewEnv ?? canonicalActiveEnv;
  const activeMeta = WORLD_THEMES.find((w) => w.id === activeEnvForPreview) ?? WORLD_THEMES[0];
  const previewPersonality = getWorldPersonality(activeEnvForPreview);

  const activeReactionOrDialogue =
    activeReaction && activeReaction.envId === activeEnvForPreview
      ? activeReaction
      : previewEnv
      ? {
          line: previewPersonality.themeChangeReaction.line,
          pose: previewPersonality.themeChangeReaction.pose,
          gaze: previewPersonality.themeChangeReaction.gaze,
        }
      : {
          line: previewPersonality.greetingLines[0],
          pose: previewPersonality.idleAnimation.pose,
          gaze: previewPersonality.idleAnimation.gaze,
        };

  const handleSelectTheme = async (newTheme: AppTheme) => {
    try {
      await setTheme(newTheme);
      showToast(`Switched to ${newTheme === "dark" ? "Dark" : "Light"} theme`, "success");
    } catch {
      showToast("Could not save theme preference.", "danger");
    }
  };

  const handleApplyEnvironment = async (envId: LivingEnvironmentId) => {
    setIsApplying(true);
    try {
      await setLivingEnvironment(envId);
      setPreviewEnv(null);
      if (!isMuted) {
        playTrack(envId as AudioTrackId);
      }
      const meta = WORLD_THEMES.find((w) => w.id === envId);
      showToast(`Living environment updated to ${meta?.name ?? envId}!`, "success");
    } catch {
      showToast("Could not save living environment preference.", "danger");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Theme Selection Card */}
      <Card className="flex flex-col gap-4 p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-primary">
            Appearance & Theme
          </h2>
          <p className="text-sm text-ink-secondary">
            Choose your preferred light or dark visual style. Living worlds adapt to both seamlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Dark Mode Tile */}
          <button
            type="button"
            onClick={() => handleSelectTheme("dark")}
            className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all ${
              theme === "dark"
                ? "border-cyan-400 bg-slate-900/90 shadow-[0_0_15px_rgba(94,231,224,0.25)] ring-1 ring-cyan-400"
                : "border-slate-700/60 bg-slate-900/40 hover:border-slate-500"
            }`}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-cyan-300">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Dark Theme</p>
              <p className="text-xs text-ink-muted">Deep celestial canvas with glowing luminescent accents</p>
            </div>
          </button>

          {/* Light Mode Tile */}
          <button
            type="button"
            onClick={() => handleSelectTheme("light")}
            className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all ${
              theme === "light"
                ? "border-cyan-500 bg-slate-100 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-500"
                : "border-slate-300/40 bg-slate-800/40 hover:border-slate-400"
            }`}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-primary">Light Theme</p>
              <p className="text-xs text-ink-muted">Crisp daytime surface with soft contrast and high readability</p>
            </div>
          </button>
        </div>
      </Card>

      {/* 2. Living Worlds Catalog Card */}
      <Card className="flex flex-col gap-4 p-6">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink-primary">
              Living Environments
            </h2>
            <span className="font-mono text-xs text-ink-muted">
              8 Distinct Worlds Available
            </span>
          </div>
          <p className="text-sm text-ink-secondary mt-1">
            Select the living world backdrop that breathes life into Companion as you organize your life.
          </p>
        </div>

        {/* Live Interactive Preview Box with Companion Reaction */}
        <div
          className="relative min-h-[260px] sm:min-h-[290px] w-full overflow-hidden rounded-2xl border border-white/10 shadow-inner bg-slate-950 flex flex-col items-center justify-center p-4 transition-all duration-700"
          style={
            {
              "--accent-primary": previewPersonality.companionLook.accentPrimary,
              "--accent-secondary": previewPersonality.companionLook.accentSecondary,
              "--world-glow": previewPersonality.companionLook.glowColor,
              "--world-halo": previewPersonality.companionLook.haloColor,
            } as React.CSSProperties
          }
        >
          <div className="absolute inset-0">
            <LivingWorldBackdrop environment={activeEnvForPreview} calm={false} />
          </div>

          <div className="relative z-10 w-full max-w-md my-auto">
            <LivingCompanionGuide
              pose={activeReactionOrDialogue.pose}
              gaze={activeReactionOrDialogue.gaze}
              dialogueText={activeReactionOrDialogue.line}
              name={previewPersonality.companionLook.badgeLabel}
              className="scale-90"
            />
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-2.5 rounded-full border border-white/15 bg-slate-900/85 px-3.5 py-1.5 text-xs text-white backdrop-blur-md shadow-md z-20">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: previewPersonality.companionLook.accentPrimary }} />
            <span className="text-sm">{activeMeta.icon}</span>
            <span className="font-mono uppercase tracking-wider text-[11px] font-semibold">
              {activeEnvForPreview === canonicalActiveEnv ? "Active" : "Previewing"}: {activeMeta.name}
            </span>
            <span className="text-[10px] text-ink-muted hidden sm:inline">
              ({activeMeta.subtitle})
            </span>
          </div>
        </div>

        {/* 8 Living Worlds Grid Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {WORLD_THEMES.map((world) => {
            const isCurrent = canonicalActiveEnv === world.id;
            const isPreviewing = activeEnvForPreview === world.id;

            return (
              <div
                key={world.id}
                onMouseEnter={() => setPreviewEnv(world.id)}
                className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                  isCurrent
                    ? "border-cyan-400 bg-slate-900/95 shadow-[0_0_15px_rgba(94,231,224,0.25)] ring-1 ring-cyan-400"
                    : isPreviewing
                    ? "border-violet-400/60 bg-slate-900/80 shadow-sm"
                    : "border-white/10 bg-slate-900/50 hover:border-white/20"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{world.icon}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-mono text-cyan-300 font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-ink-primary">{world.name}</h3>
                  <p className="mt-1 text-xs text-ink-muted leading-relaxed line-clamp-2">
                    {world.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-white/5">
                  <Button
                    size="sm"
                    variant={isCurrent ? "secondary" : "ghost"}
                    disabled={isCurrent || isApplying}
                    onClick={() => handleApplyEnvironment(world.id)}
                    className="w-full text-xs font-medium"
                  >
                    {isCurrent ? "Currently Active" : "Apply World"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. Ambient Soundtrack & Audio Card */}
      <Card className="flex flex-col gap-5 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
                <Music className="h-4 w-4" />
              </div>
              <h2 className="font-display text-lg font-semibold text-ink-primary">
                Ambient Soundtrack & Audio
              </h2>
            </div>
            <p className="text-sm text-ink-secondary mt-1">
              Immersive procedural soundscapes and gentle ambient music that flow with your living world.
            </p>
          </div>

          {/* Sound Mute / Unmute Button */}
          <Button
            size="sm"
            variant={isMuted ? "secondary" : "primary"}
            onClick={() => {
              const nextMuted = toggleMute();
              if (!nextMuted) {
                playTrack(canonicalActiveEnv as AudioTrackId);
                showToast("Ambient soundtrack enabled", "success");
              } else {
                showToast("Ambient soundtrack muted", "info");
              }
            }}
            className="inline-flex items-center gap-2 self-start sm:self-auto text-xs"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-ink-muted" /> : <Volume2 className="h-4 w-4 text-cyan-300" />}
            <span>{isMuted ? "Sound Muted (Click to Unmute)" : "Sound Active"}</span>
          </Button>
        </div>

        {/* Master Volume Slider */}
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-white flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Master Ambient Volume
            </span>
            <span className="font-mono text-cyan-300">{Math.round(volume * 100)}%</span>
          </div>

          <div className="flex items-center gap-3">
            <VolumeX className="h-4 w-4 text-ink-muted shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => {
                const newVol = parseFloat(e.target.value);
                setVolume(newVol);
                if (isMuted && newVol > 0) {
                  toggleMute();
                  playTrack(canonicalActiveEnv as AudioTrackId);
                }
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400 transition-all hover:bg-slate-700"
              aria-label="Master ambient volume"
            />
            <Volume2 className="h-4 w-4 text-cyan-400 shrink-0" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-1 text-[11px] text-ink-muted gap-1">
            <span>
              {isMuted
                ? "Audio muted — tap slider or toggle above to begin ambient playback"
                : `Playing: ${activeTrack ?? canonicalActiveEnv} ambient pad`}
            </span>
            <span className="font-mono text-[10px] text-cyan-400/80">Web Audio API · Realtime Synth</span>
          </div>
        </div>
      </Card>

      {/* 4. Replay Story Card */}
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-primary">
              Living Story Prologue
            </h2>
            <p className="text-sm text-ink-secondary">
              Replay the interactive 6-scene environmental story with your companion guide Nikki anytime.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => router.push("/?replay=true")}
            className="inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-cyan-400" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
            <span>Replay Story</span>
          </Button>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3 text-xs text-ink-muted leading-relaxed">
          ✦ Replaying the story is purely experiential. It will never reset, alter, or erase your existing goals, tasks, conversations, memories, timetable, or settings.
        </div>
      </Card>
    </div>
  );
}
