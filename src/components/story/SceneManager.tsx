"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useStory } from "@/context/StoryContext";
import { Scene } from "./Scene";
import { StoryControls } from "./StoryControls";
import { StoryEndPanel } from "./StoryEndPanel";
import { ease } from "@/lib/motion";

/**
 * Owns scene-to-scene transitions (a slow crossfade) and layers the
 * click/tap-to-continue surface beneath the always-accessible
 * controls. Advancing the story is driven entirely by user
 * interaction — there is no autoplay timer to rush past.
 */
export function SceneManager() {
  const { scene, sceneIndex, lineIndex, advance, isComplete } = useStory();

  if (isComplete) {
    return <StoryEndPanel />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.id}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: ease.gentle }}
        >
          <Scene scene={scene} lineIndex={lineIndex} />
        </motion.div>
      </AnimatePresence>

      <button
        type="button"
        onClick={advance}
        aria-label="Continue the story"
        className="absolute inset-0 z-10 h-full w-full cursor-pointer bg-transparent"
      />

      <StoryControls />
    </div>
  );
}