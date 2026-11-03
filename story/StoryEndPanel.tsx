"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { fadeIn } from "@/lib/motion";
import { useStory } from "@/context/StoryContext";
import { useAuth } from "@/context/AuthContext";

/**
 * Shown once the story reaches its end (the ENTER_APP event). A real
 * navigation choice, not an automatic redirect — and, per the spec,
 * an authenticated visitor goes straight to the dashboard rather than
 * back through signup.
 */
export function StoryEndPanel() {
  const router = useRouter();
  const { replay } = useStory();
  const { firebaseUser } = useAuth();

  function enterApp() {
    router.push(firebaseUser ? "/dashboard" : "/signup");
  }

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="relative flex h-screen w-full flex-col items-center justify-center gap-6 overflow-hidden bg-surface-primary bg-companion-gradient px-6 text-center"
    >
      <div className="h-20 w-20" style={{ aspectRatio: "1 / 1" }}>
        <CompanionCharacter pose="idle" className="h-full w-full" />
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink-primary sm:text-3xl">Ready when you are.</h2>
        <p className="mt-2 max-w-sm text-ink-secondary">Let's figure out your life together.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="primary" size="lg" onClick={enterApp}>
          Enter Companion
        </Button>
        <Button variant="ghost" size="md" onClick={replay}>
          Replay the story
        </Button>
      </div>
    </motion.div>
  );
}