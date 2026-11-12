"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import { useWorldTheme } from "@/context/WorldThemeContext";
import { useSoundtrack } from "@/context/SoundtrackContext";
import { SpaceLivingWorld } from "@/components/world/SpaceLivingWorld";
import { GardenLivingWorld } from "@/components/world/GardenLivingWorld";
import { OceanLivingWorld } from "@/components/world/OceanLivingWorld";
import { LivingWorldBackdrop } from "@/components/world/LivingWorldBackdrop";
import { Scene01AwakeningDiscovery } from "./discovery/Scene01AwakeningDiscovery";
import { Scene02CosmicVaultDiscovery } from "./discovery/Scene02CosmicVaultDiscovery";
import { Scene03GardenGrowthDiscovery } from "./discovery/Scene03GardenGrowthDiscovery";
import { Scene04AbyssalSanctuaryDiscovery } from "./discovery/Scene04AbyssalSanctuaryDiscovery";
import { Scene05HarmonicConvergenceDiscovery } from "./discovery/Scene05HarmonicConvergenceDiscovery";
import { Scene06WorldGatewayDiscovery } from "./discovery/Scene06WorldGatewayDiscovery";
import type { AppTheme, LivingEnvironmentId } from "@/types/profile";

const STORAGE_KEY = "companion:intro-completed";

interface DiscoverySceneMeta {
  id: string;
  number: number;
  title: string;
  badge: string;
  env: LivingEnvironmentId | "convergence" | "gateway";
}

const DISCOVERY_SCENES: DiscoverySceneMeta[] = [
  {
    id: "awakening",
    number: 1,
    title: "A World Comes Alive",
    badge: "01 / Awakening",
    env: "cosmic-dream",
  },
  {
    id: "memory-vault",
    number: 2,
    title: "The Cosmic Vault",
    badge: "02 / Memories & Capsules",
    env: "cosmic-dream",
  },
  {
    id: "garden-growth",
    number: 3,
    title: "Garden of Growth",
    badge: "03 / Goals & Tasks",
    env: "enchanted-garden",
  },
  {
    id: "abyssal-sanctuary",
    number: 4,
    title: "Abyssal Sanctuary",
    badge: "04 / Focus & Journal",
    env: "abyssal-dreams",
  },
  {
    id: "convergence",
    number: 5,
    title: "Harmonic Convergence",
    badge: "05 / Living World",
    env: "convergence",
  },
  {
    id: "world-gateway",
    number: 6,
    title: "Welcome Home",
    badge: "06 / Your Sanctuary",
    env: "gateway",
  },
];

export function LivingWorldStoryExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const { firebaseUser, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const { theme, livingEnvironment, updateWorldSettings } = useWorldTheme();

  const isReplayMode = searchParams.get("replay") === "true";

  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isEntering, setIsEntering] = useState(false);
  const { isMuted, toggleMute, playTrack } = useSoundtrack();
  const soundEnabled = !isMuted;

  const handleToggleSound = useCallback(() => {
    const nextMuted = toggleMute();
    if (!nextMuted) {
      playTrack("intro");
    }
  }, [toggleMute, playTrack]);

  const scene = DISCOVERY_SCENES[currentSceneIndex];
  const isFinalScene = currentSceneIndex === DISCOVERY_SCENES.length - 1;

  // Auto-redirect authenticated returning users directly to their companion sanctuary
  useEffect(() => {
    if (isReplayMode) return;
    if (authLoading || profileLoading) return;

    if (firebaseUser) {
      if (profile?.onboardingCompleted !== false) {
        router.replace("/dashboard");
      } else {
        router.replace("/onboarding");
      }
    }
  }, [authLoading, profileLoading, firebaseUser, profile, isReplayMode, router]);

  // Completion / Skip handler (Always accessible)
  const handleComplete = useCallback(async () => {
    setIsEntering(true);

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, "true");
      }

      if (firebaseUser) {
        try {
          await updateProfile({
            introCompleted: true,
          });
        } catch {
          // Non-blocking
        }

        if (profile?.onboardingCompleted) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } else {
        router.push("/signup");
      }
    } catch {
      router.push("/dashboard");
    }
  }, [firebaseUser, profile, updateProfile, router]);

  // Final Gateway completion with user's selected theme & environment
  const handleGatewayEnter = useCallback(
    async (selectedTheme: AppTheme, selectedEnv: LivingEnvironmentId) => {
      setIsEntering(true);

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, "true");
        }

        await updateWorldSettings({
          theme: selectedTheme,
          livingEnvironment: selectedEnv,
        });

        if (firebaseUser) {
          try {
            await updateProfile({
              introCompleted: true,
              theme: selectedTheme,
              livingEnvironment: selectedEnv,
            });
          } catch {
            // Non-blocking
          }

          if (profile?.onboardingCompleted) {
            router.push("/dashboard");
          } else {
            router.push("/onboarding");
          }
        } else {
          router.push("/dashboard");
        }
      } catch {
        router.push("/dashboard");
      }
    },
    [firebaseUser, profile, updateProfile, updateWorldSettings, router]
  );

  const handleNext = useCallback(() => {
    if (!isMuted) {
      playTrack("intro");
    }
    if (currentSceneIndex < DISCOVERY_SCENES.length - 1) {
      setCurrentSceneIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentSceneIndex, handleComplete, isMuted, playTrack]);

  const handlePrev = useCallback(() => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex((prev) => prev - 1);
    }
  }, [currentSceneIndex]);

  const handleJumpToScene = useCallback((index: number) => {
    if (index >= 0 && index < DISCOVERY_SCENES.length) {
      setCurrentSceneIndex(index);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleComplete();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleToggleSound();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrev, handleComplete, handleToggleSound]);

  const companionName = profile?.companionName ?? "Nikki";

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-slate-950 font-sans text-white select-none">
      {/* Dynamic Living Environment Background Layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.env}
          className="absolute inset-0"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {scene.env === "cosmic-dream" && <SpaceLivingWorld calm={false} />}
          {scene.env === "enchanted-garden" && <GardenLivingWorld calm={false} />}
          {scene.env === "abyssal-dreams" && <OceanLivingWorld calm={false} />}
          {scene.env === "convergence" && (
            <div className="absolute inset-0">
              <SpaceLivingWorld calm={true} />
              <div className="absolute inset-x-0 bottom-0 h-1/2 opacity-35">
                <OceanLivingWorld calm={true} />
              </div>
            </div>
          )}
          {scene.env === "gateway" && <LivingWorldBackdrop calm={false} />}
        </motion.div>
      </AnimatePresence>

      {/* Screen Reader Live Region */}
      <div className="sr-only" aria-live="polite">
        Scene {scene.number} of {DISCOVERY_SCENES.length}: {scene.title}
      </div>

      {/* Top Header & Navigation Bar */}
      <header className="relative z-30 flex w-full items-center justify-between px-5 py-4 sm:px-8 sm:py-5 border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
        {/* Brand & Sound Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold tracking-tight text-white sm:text-xl">
              Companion
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </div>

          <button
            type="button"
            onClick={handleToggleSound}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs text-ink-muted backdrop-blur-md transition-colors hover:border-white/20 hover:text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
            aria-label={soundEnabled ? "Mute ambient audio" : "Enable ambient sound"}
            title="Press 'M' to toggle sound"
          >
            {soundEnabled ? (
              <>
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-cyan-400" fill="currentColor">
                  <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.776L4.854 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.854l3.529-3.276a1 1 0 011-.148zM14.657 5.343a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 4.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 10c0-1.879-.646-3.608-1.729-4.986a1 1 0 010-1.414z" />
                </svg>
                <span className="font-mono text-[11px] text-cyan-300">Sound ON</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-ink-muted" fill="currentColor">
                  <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.776L4.854 13.5H2a1 1 0 01-1-1v-5a1 1 0 011-1h2.854l3.529-3.276a1 1 0 011-.148zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" />
                </svg>
                <span className="font-mono text-[11px]">Sound OFF</span>
              </>
            )}
          </button>
        </div>

        {/* 6-Step Segmented Progress Bar */}
        <div className="hidden md:flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Story Scenes">
            {DISCOVERY_SCENES.map((s, idx) => {
              const isPast = idx < currentSceneIndex;
              const isCurrent = idx === currentSceneIndex;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleJumpToScene(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                    isCurrent
                      ? "w-8 bg-gradient-to-r from-cyan-400 to-violet-400 shadow-[0_0_8px_#5ee7e0]"
                      : isPast
                      ? "w-4 bg-violet-400/60 hover:bg-violet-300"
                      : "w-4 bg-white/15 hover:bg-white/30"
                  }`}
                  aria-label={`Jump to scene ${idx + 1}: ${s.title}`}
                  aria-selected={isCurrent}
                />
              );
            })}
          </div>
          <span className="font-mono text-[11px] font-medium tracking-widest uppercase text-ink-muted">
            {scene.badge} · {scene.title}
          </span>
        </div>

        {/* Skip Intro Button (Always accessible) */}
        <div>
          <button
            type="button"
            onClick={handleComplete}
            disabled={isEntering}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-900/70 px-4 py-2 text-xs font-medium text-ink-secondary shadow-sm backdrop-blur-md transition-all duration-200 hover:border-cyan-400/40 hover:bg-slate-800/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-95 disabled:opacity-50"
            aria-label="Skip story and enter Companion immediately"
          >
            <span>{isEntering ? "Entering..." : "Skip Intro"}</span>
            <span className="font-bold transition-transform duration-200 group-hover:translate-x-0.5">
              »
            </span>
          </button>
        </div>
      </header>

      {/* Main Narrative Stage Area */}
      <main className="relative z-20 flex flex-1 flex-col items-center justify-center px-4 py-4 sm:py-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={scene.id}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 14, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -14, scale: 0.98 }
            }
            transition={{ duration: 0.65, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full flex items-center justify-center"
          >
            {currentSceneIndex === 0 && (
              <Scene01AwakeningDiscovery onAdvance={handleNext} companionName={companionName} />
            )}
            {currentSceneIndex === 1 && (
              <Scene02CosmicVaultDiscovery onAdvance={handleNext} companionName={companionName} />
            )}
            {currentSceneIndex === 2 && (
              <Scene03GardenGrowthDiscovery onAdvance={handleNext} companionName={companionName} />
            )}
            {currentSceneIndex === 3 && (
              <Scene04AbyssalSanctuaryDiscovery onAdvance={handleNext} companionName={companionName} />
            )}
            {currentSceneIndex === 4 && (
              <Scene05HarmonicConvergenceDiscovery onAdvance={handleNext} companionName={companionName} />
            )}
            {currentSceneIndex === 5 && (
              <Scene06WorldGatewayDiscovery
                initialTheme={theme}
                initialEnvironment={livingEnvironment}
                onEnterCompanion={handleGatewayEnter}
                isSubmitting={isEntering}
                companionName={companionName}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Story Controls */}
      <footer className="relative z-30 flex w-full flex-col items-center gap-3 px-5 py-4 sm:px-8 border-t border-white/10 bg-slate-950/40 backdrop-blur-md">
        {/* Mobile progress indicator */}
        <div className="flex md:hidden items-center gap-1.5">
          {DISCOVERY_SCENES.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-200 ${
                idx === currentSceneIndex ? "w-6 bg-cyan-400" : idx < currentSceneIndex ? "w-2 bg-violet-400/60" : "w-2 bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="flex w-full items-center justify-between">
          {/* Back button */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentSceneIndex === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-xs font-medium text-ink-secondary backdrop-blur-md transition-all hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:pointer-events-none disabled:opacity-30"
            aria-label="Go to previous scene"
          >
            ← <span>Back</span>
          </button>

          {/* Desktop keyboard hint */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-ink-muted">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Arrow keys</kbd>
            <span>to navigate</span>
            <span>·</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
            <span>to skip</span>
          </div>

          {/* Next / Continue button (hidden on final scene because Scene06 has dedicated 'Enter Your World') */}
          {!isFinalScene ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-2 text-xs font-semibold text-white shadow-[0_0_15px_rgba(94,231,224,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(124,92,255,0.4)] focus:outline-none focus:ring-2 focus:ring-cyan-400 active:scale-95"
              aria-label="Advance story"
            >
              <span>Continue</span>
              <span>→</span>
            </button>
          ) : (
            <div className="w-16" />
          )}
        </div>
      </footer>
    </div>
  );
}
