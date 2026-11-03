"use client";

import { motion } from "framer-motion";
import { CinematicScene } from "@/components/landing/CinematicScene";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { DialogueBox } from "./DialogueBox";
import { ENVIRONMENTS } from "./environments";
import { fadeIn } from "@/lib/motion";
import type { StoryScene } from "@/types/story";

interface SceneProps {
  scene: StoryScene;
  lineIndex: number;
}

/** Renders one scene: its environment, the Companion, and the current dialogue line. Knows nothing about story progression — SceneManager owns that. */
export function Scene({ scene, lineIndex }: SceneProps) {
  const Environment = ENVIRONMENTS[scene.environment];
  const line = scene.dialogue[lineIndex];

  return (
    <CinematicScene
      ariaLabel={scene.title}
      background={<Environment />}
      className="flex h-full w-full items-center justify-center px-6"
    >
      {/* Scene 12's "the environment slowly brightens" — a soft wash over
          whatever environment is active, not a new environment of its own. */}
      {scene.brighten && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.10), transparent 65%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 6, ease: "easeInOut" }}
          aria-hidden="true"
        />
      )}

      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="flex w-full max-w-3xl flex-col items-center gap-8 py-16 text-center"
      >
        <div className="w-24 sm:w-32 md:w-40" style={{ aspectRatio: "1 / 1" }}>
          <CompanionCharacter pose={scene.companionPose} className="h-full w-full" />
        </div>
        <DialogueBox line={line} />
      </motion.div>
    </CinematicScene>
  );
}