"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CinematicScene } from "./CinematicScene";
import { SpaceScene } from "../landing/space/SpaceScene";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { SpeechBubble } from "@/components/character/SpeechBubble";
import { ease } from "@/lib/motion";

/**
 * Scene 1 — The Call / Arrival, set inside the Space environment.
 *
 * Timeline: quiet → walk in → notice → stop & turn → wave →
 * "Hey... you're here." → pause → "Come with me." → look toward the path.
 */
type Stage = "quiet" | "walking" | "turning" | "waving" | "bubble1" | "pause" | "bubble2" | "lookAhead";

const NORMAL_TIMELINE: { time: number; stage: Stage }[] = [
  { time: 0, stage: "quiet" },
  { time: 2000, stage: "walking" },
  { time: 7000, stage: "turning" },
  { time: 9000, stage: "waving" },
  { time: 11000, stage: "bubble1" },
  { time: 14000, stage: "pause" },
  { time: 17000, stage: "bubble2" },
  { time: 20000, stage: "lookAhead" },
];

const REDUCED_TIMELINE: { time: number; stage: Stage }[] = [
  { time: 0, stage: "quiet" },
  { time: 150, stage: "walking" },
  { time: 500, stage: "turning" },
  { time: 800, stage: "waving" },
  { time: 1100, stage: "bubble1" },
  { time: 1900, stage: "pause" },
  { time: 2200, stage: "bubble2" },
  { time: 3000, stage: "lookAhead" },
];

export function Scene1() {
  const prefersReducedMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>("quiet");

  useEffect(() => {
    const timeline = prefersReducedMotion ? REDUCED_TIMELINE : NORMAL_TIMELINE;
    const timers = timeline.map(({ time, stage: s }) => setTimeout(() => setStage(s), time));
    return () => timers.forEach(clearTimeout);
  }, [prefersReducedMotion]);

  const hasEntered = stage !== "quiet";
  const pose =
    stage === "walking"
      ? "walk"
      : stage === "turning"
        ? "turn"
        : stage === "waving"
          ? "wave"
          : stage === "lookAhead"
            ? "lookAhead"
            : "idle";

  const walkDuration = prefersReducedMotion ? 0.4 : 3;

  return (
    <CinematicScene
      ariaLabel="Companion introduction"
      background={<SpaceScene />}
      className="flex min-h-screen items-center justify-center px-6"
    >
      <div className="flex w-full max-w-3xl flex-col items-center gap-8 py-24 text-center">
        <motion.div
          className="w-28 sm:w-36 md:w-48 lg:w-56"
          style={{ aspectRatio: "1 / 1" }}
          initial={prefersReducedMotion ? { opacity: 0 } : { x: -220, opacity: 0 }}
          animate={hasEntered ? { x: 0, opacity: 1 } : {}}
          transition={{ duration: walkDuration, ease: ease.gentle }}
        >
          <CompanionCharacter pose={pose} className="h-full w-full" />
        </motion.div>

        <div className="flex min-h-[6rem] flex-col items-center gap-3" aria-live="polite">
          <AnimatePresence>
            {stage === "bubble1" && <SpeechBubble key="bubble1">Hey... you're here.</SpeechBubble>}
            {(stage === "bubble2" || stage === "lookAhead") && (
              <SpeechBubble key="bubble2">Come with me.</SpeechBubble>
            )}
          </AnimatePresence>
        </div>
      </div>
    </CinematicScene>
  );
}