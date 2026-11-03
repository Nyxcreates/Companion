"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { Card } from "@/components/ui/Card";
import { slideUp } from "@/lib/motion";

interface StepShellProps {
  dialogue: string;
  step: number;
  totalSteps: number;
  children: ReactNode;
}

/** Shared frame for every onboarding step: the Companion, a line of dialogue, the step's form, and a subtle progress indicator. */
export function StepShell({ dialogue, step, totalSteps, children }: StepShellProps) {
  return (
    <motion.div
      variants={slideUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex w-full max-w-md flex-col items-center gap-6"
    >
      <div className="h-16 w-16">
        <CompanionCharacter pose="idle" className="h-full w-full" />
      </div>
      <p className="text-center font-display text-lg text-ink-primary">{dialogue}</p>
      <Card className="w-full">{children}</Card>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i === step ? "bg-accent-secondary" : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}