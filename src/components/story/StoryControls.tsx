"use client";

import { Button } from "@/components/ui/Button";
import { useStory } from "@/context/StoryContext";

/** Subtle skip/replay controls plus a thin progress indicator — never visually dominant, per spec. */
export function StoryControls() {
  const { skip, replay, progress } = useStory();

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-white/5">
        <div
          className="h-full bg-accent-secondary/50 transition-all duration-700"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="absolute right-4 top-4 z-20 flex gap-2 sm:right-6 sm:top-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            replay();
          }}
        >
          Replay
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            skip();
          }}
        >
          Skip story
        </Button>
      </div>
    </>
  );
}