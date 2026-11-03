"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { STORY_SCENES } from "@/lib/story/scenes";
import { STORY_EVENT_LABELS } from "@/lib/story/storyEvents";
import type { StoryEventId, StoryScene } from "@/types/story";

interface StoryContextValue {
  scene: StoryScene;
  sceneIndex: number;
  lineIndex: number;
  totalScenes: number;
  progress: number;
  isComplete: boolean;
  advance: () => void;
  skip: () => void;
  replay: () => void;
}

const StoryContext = createContext<StoryContextValue | undefined>(undefined);

/**
 * Owns the story's state machine: which scene, which line, whether
 * the story has finished. Nothing here persists to a database yet —
 * per the task, story progress isn't wired to MongoDB in this
 * feature, only the state shape that will eventually be saved.
 */
export function StoryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { firebaseUser } = useAuth();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const scene = STORY_SCENES[Math.min(sceneIndex, STORY_SCENES.length - 1)];

  function fireEvent(eventId?: StoryEventId) {
    if (!eventId || eventId === "ENTER_APP") return;
    const label = STORY_EVENT_LABELS[eventId];
    showToast(`${label} isn't built yet — the story continues for now.`, "info");
  }

  function advance() {
    if (isComplete) return;
    const current = STORY_SCENES[sceneIndex];

    if (lineIndex < current.dialogue.length - 1) {
      setLineIndex((i) => i + 1);
      return;
    }

    fireEvent(current.event);

    if (current.event === "ENTER_APP") {
      setIsComplete(true);
      return;
    }

    if (sceneIndex < STORY_SCENES.length - 1) {
      setSceneIndex((i) => i + 1);
      setLineIndex(0);
    } else {
      setIsComplete(true);
    }
  }

  /**
   * Per spec: skipping goes directly to the real application — and, per
   * the same "authenticated -> dashboard" rule the end panel follows,
   * an already-signed-in visitor shouldn't be routed back through signup.
   */
  function skip() {
    router.push(firebaseUser ? "/dashboard" : "/signup");
  }

  function replay() {
    setSceneIndex(0);
    setLineIndex(0);
    setIsComplete(false);
  }

  const value = useMemo<StoryContextValue>(
    () => ({
      scene,
      sceneIndex,
      lineIndex,
      totalScenes: STORY_SCENES.length,
      progress: (sceneIndex + 1) / STORY_SCENES.length,
      isComplete,
      advance,
      skip,
      replay,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, sceneIndex, lineIndex, isComplete, firebaseUser]
  );

  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>;
}

export function useStory(): StoryContextValue {
  const ctx = useContext(StoryContext);
  if (!ctx) {
    throw new Error("useStory must be used within a StoryProvider");
  }
  return ctx;
}