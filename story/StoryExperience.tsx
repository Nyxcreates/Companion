"use client";

import { Suspense } from "react";
import { LivingWorldStoryExperience } from "./LivingWorldStoryExperience";

/**
 * Public entry point for Companion's living, story-driven world opening experience.
 * Wraps the interactive 6-scene character-led storyline with Suspense for Next.js query parameter resolution.
 */
export function StoryExperience() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-ink-muted">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <span className="font-mono text-xs text-ink-secondary">Entering Companion...</span>
          </div>
        </div>
      }
    >
      <LivingWorldStoryExperience />
    </Suspense>
  );
}
