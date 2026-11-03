"use client";

import { AnimatePresence } from "framer-motion";
import { SpeechBubble } from "@/components/character/SpeechBubble";
import type { DialogueLine } from "@/types/story";

interface DialogueBoxProps {
  line: DialogueLine;
}

/** Renders the current line of dialogue, crossfading when the line changes. */
export function DialogueBox({ line }: DialogueBoxProps) {
  return (
    <div className="flex min-h-[7rem] flex-col items-center gap-3" aria-live="polite">
      <AnimatePresence mode="wait">
        <SpeechBubble key={line.id}>{line.text}</SpeechBubble>
      </AnimatePresence>
      <span className="animate-pulse text-xs text-ink-muted/60">Tap to continue</span>
    </div>
  );
}