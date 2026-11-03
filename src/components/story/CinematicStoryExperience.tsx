"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";
import { CINEMATIC_SCENES } from "@/lib/story/cinematicScenes";
import { CosmicStoryBackground } from "./CosmicStoryBackground";

import { Scene01TheBeginning } from "./scenes/Scene01TheBeginning";
import { Scene02RealityOfLife } from "./scenes/Scene02RealityOfLife";
import { Scene03ArrivalOfCompanion } from "./scenes/Scene03ArrivalOfCompanion";
import { Scene04LifeUnderstood } from "./scenes/Scene04LifeUnderstood";
import { Scene05DreamsBecomeSteps } from "./scenes/Scene05DreamsBecomeSteps";
import { Scene06SpaceToBeginAgain } from "./scenes/Scene06SpaceToBeginAgain";
import { Scene07YourWorldYourWay } from "./scenes/Scene07YourWorldYourWay";
import { Scene08EnterCompanion } from "./scenes/Scene08EnterCompanion";

const STORAGE_KEY = "companion:intro-completed";

export function CinematicStoryExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const { firebaseUser, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();

  const isReplayMode = searchParams.get("replay") === "true";

  const [sceneIndex, setSceneIndex] = useState(0);
  const [blockIndex, setBlockIndex] = useState(0);
  const [isEntering, setIsEntering] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Audio synthesis reference
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const currentScene = CINEMATIC_SCENES[sceneIndex];
  const isFinalScene = sceneIndex === CINEMATIC_SCENES.length - 1;

  // Auto-redirect returning users if they completed intro and did not ask for replay
  useEffect(() => {
    if (isReplayMode) return;
    if (authLoading || profileLoading) return;

    const localCompleted = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true";
    const profileCompleted = profile?.introCompleted ?? false;

    if (firebaseUser && (localCompleted || profileCompleted)) {
      if (profile?.onboardingCompleted) {
        router.replace("/dashboard");
      } else {
        router.replace("/onboarding");
      }
    }
  }, [authLoading, profileLoading, firebaseUser, profile, isReplayMode, router]);

  // Handle ambient soothing sound toggle
  useEffect(() => {
    if (!soundEnabled) {
      if (gainNodeRef.current && audioContextRef.current) {
        const ctx = audioContextRef.current;
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, ctx.currentTime);
        gainNodeRef.current.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
        setTimeout(() => {
          ctx.suspend().catch(() => {});
        }, 850);
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gainNodeRef.current = masterGain;

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(320, ctx.currentTime);
        filter.Q.setValueAtTime(1.5, ctx.currentTime);

        // Harmonic oscillator 1 (110 Hz - A2)
        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(110, ctx.currentTime);

        // Harmonic oscillator 2 (165 Hz - E3)
        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(165, ctx.currentTime);

        // Chime oscillator (330 Hz - E4)
        const osc3 = ctx.createOscillator();
        osc3.type = "sine";
        osc3.frequency.setValueAtTime(330, ctx.currentTime);

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc3.connect(subGain);
        subGain.connect(filter);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(masterGain);
        masterGain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc3.start();
      }

      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }

      if (gainNodeRef.current && audioContextRef.current) {
        const ctx = audioContextRef.current;
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, ctx.currentTime);
        gainNodeRef.current.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 1.2);
      }
    } catch {
      // Audio autoplay policy fallback
    }

    return () => {
      // Cleanup on unmount handled in parent hook
    };
  }, [soundEnabled]);

  // Teardown audio on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Completion / Exit handler
  const handleComplete = useCallback(async () => {
    setIsEntering(true);

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, "true");
      }

      if (firebaseUser) {
        // Persist intro completion to user profile
        try {
          await updateProfile({ introCompleted: true });
        } catch {
          // Non-blocking: local storage flag ensures user still advances
        }

        if (profile?.onboardingCompleted) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } else {
        // Guest / Unauthenticated visitor
        router.push("/signup");
      }
    } catch {
      router.push("/login");
    }
  }, [firebaseUser, profile, updateProfile, router]);

  // Progression handlers
  const handleNext = useCallback(() => {
    const totalBlocks = currentScene.blocks.length;
    if (blockIndex < totalBlocks - 1) {
      setBlockIndex((b) => b + 1);
    } else if (sceneIndex < CINEMATIC_SCENES.length - 1) {
      setSceneIndex((s) => s + 1);
      setBlockIndex(0);
    } else {
      handleComplete();
    }
  }, [blockIndex, sceneIndex, currentScene, handleComplete]);

  const handlePrev = useCallback(() => {
    if (blockIndex > 0) {
      setBlockIndex((b) => b - 1);
    } else if (sceneIndex > 0) {
      const prevSceneIdx = sceneIndex - 1;
      const prevBlocks = CINEMATIC_SCENES[prevSceneIdx].blocks.length;
      setSceneIndex(prevSceneIdx);
      setBlockIndex(prevBlocks - 1);
    }
  }, [blockIndex, sceneIndex]);

  const handleJumpToScene = useCallback((targetIndex: number) => {
    if (targetIndex >= 0 && targetIndex < CINEMATIC_SCENES.length) {
      setSceneIndex(targetIndex);
      setBlockIndex(0);
    }
  }, []);

  const handleReplay = useCallback(() => {
    setSceneIndex(0);
    setBlockIndex(0);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
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
        setSoundEnabled((s) => !s);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrev, handleComplete]);

  // Render scene component
  const renderSceneContent = () => {
    switch (currentScene.id) {
      case "the-beginning":
        return <Scene01TheBeginning currentBlockIndex={blockIndex} />;
      case "reality-of-life":
        return <Scene02RealityOfLife currentBlockIndex={blockIndex} />;
      case "arrival-of-companion":
        return <Scene03ArrivalOfCompanion currentBlockIndex={blockIndex} />;
      case "life-understood":
        return <Scene04LifeUnderstood currentBlockIndex={blockIndex} />;
      case "dreams-become-steps":
        return <Scene05DreamsBecomeSteps currentBlockIndex={blockIndex} />;
      case "space-to-begin-again":
        return <Scene06SpaceToBeginAgain currentBlockIndex={blockIndex} />;
      case "your-world-your-way":
        return <Scene07YourWorldYourWay currentBlockIndex={blockIndex} />;
      case "enter-companion":
        return (
          <Scene08EnterCompanion
            onEnter={handleComplete}
            onReplay={handleReplay}
            isEntering={isEntering}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-slate-950 font-sans text-white select-none">
      {/* Dynamic Cosmic Background */}
      <CosmicStoryBackground sceneIndex={sceneIndex} sceneId={currentScene.id} />

      {/* Screen Reader Live Region */}
      <div className="sr-only" aria-live="polite">
        Scene {sceneIndex + 1} of {CINEMATIC_SCENES.length}: {currentScene.title}
      </div>

      {/* Top Header & Navigation Bar */}
      <header className="relative z-30 flex w-full items-center justify-between px-5 py-4 sm:px-8 sm:py-6">
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
            onClick={() => setSoundEnabled((s) => !s)}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs text-ink-muted backdrop-blur-md transition-colors hover:border-white/20 hover:text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
            aria-label={soundEnabled ? "Mute ambient audio" : "Enable soothing ambient audio"}
            title="Press 'M' to toggle audio"
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

        {/* 8-Step Segmented Progress Bar */}
        <div className="hidden md:flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Story Scenes">
            {CINEMATIC_SCENES.map((scene, idx) => {
              const isPast = idx < sceneIndex;
              const isCurrent = idx === sceneIndex;
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => handleJumpToScene(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                    isCurrent
                      ? "w-8 bg-gradient-to-r from-cyan-400 to-violet-400 shadow-[0_0_8px_#5ee7e0]"
                      : isPast
                      ? "w-4 bg-violet-400/60 hover:bg-violet-300"
                      : "w-4 bg-white/15 hover:bg-white/30"
                  }`}
                  aria-label={`Jump to scene ${idx + 1}: ${scene.title}`}
                  aria-selected={isCurrent}
                />
              );
            })}
          </div>
          <span className="font-mono text-[11px] font-medium tracking-widest uppercase text-ink-muted">
            {currentScene.badge} · {currentScene.title}
          </span>
        </div>

        {/* Skip Intro Button (Accessible & Always Visible) */}
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
      <main
        className="relative z-20 flex flex-1 flex-col items-center justify-center px-4 py-6 text-center cursor-pointer"
        onClick={handleNext}
        tabIndex={0}
        role="region"
        aria-label="Cinematic narrative display. Tap or press space to continue."
      >
        <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentScene.id}-${blockIndex}`}
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
              transition={{ duration: 0.75, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {renderSceneContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Story Controls */}
      <footer className="relative z-30 flex w-full flex-col items-center gap-3 px-5 py-5 sm:px-8 sm:py-6">
        {/* Mobile progress indicator */}
        <div className="flex md:hidden items-center gap-1.5">
          {CINEMATIC_SCENES.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-200 ${
                idx === sceneIndex ? "w-6 bg-cyan-400" : idx < sceneIndex ? "w-2 bg-violet-400/60" : "w-2 bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="flex w-full items-center justify-between">
          {/* Back button */}
          <button
            type="button"
            onClick={handlePrev}
            disabled={sceneIndex === 0 && blockIndex === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-xs font-medium text-ink-secondary backdrop-blur-md transition-all hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:pointer-events-none disabled:opacity-30"
            aria-label="Go to previous scene"
          >
            ← <span>Back</span>
          </button>

          {/* Desktop keyboard hint */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-ink-muted">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Space</kbd>
            <span>or click to advance</span>
            <span>·</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
            <span>to skip</span>
          </div>

          {/* Next button (hidden on final scene since Scene08 has its primary CTA) */}
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
