"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CharacterPlaceholder } from "./CharacterPlaceholder";
import { SpeechBubble } from "./SpeechBubble";
import { ease } from "@/lib/motion";

interface CharacterEntranceProps {
  message?: string;
  size?: number;
}

/**
 * Walks the companion in from off-screen, lets it settle, then reveals
 * a speech bubble. Wraps CharacterPlaceholder only — swapping in the
 * real Live2D character later requires no changes here.
 */
export function CharacterEntrance({
  message = "Hey. I'm glad you're here.",
  size = 120,
}: CharacterEntranceProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hasArrived, setHasArrived] = useState(false);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    if (!hasArrived) return;
    const timer = setTimeout(() => setShowBubble(true), 300);
    return () => clearTimeout(timer);
  }, [hasArrived]);

  return (
    <div className="relative flex flex-col items-center gap-6">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { x: -180, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{
          duration: prefersReducedMotion ? 0.4 : 1.1,
          ease: ease.gentle,
        }}
        onAnimationComplete={() => setHasArrived(true)}
      >
        {/* small "notices you" nod once it stops walking */}
        <motion.div
          animate={hasArrived ? { rotate: [0, -3, 3, 0] } : {}}
          transition={{ duration: 0.7, ease: ease.standard }}
        >
          <CharacterPlaceholder size={size} />
        </motion.div>
      </motion.div>

      <div className="min-h-[3.25rem]">
        <AnimatePresence>{showBubble && <SpeechBubble key="greeting">{message}</SpeechBubble>}</AnimatePresence>
      </div>
    </div>
  );
}