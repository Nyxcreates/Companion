"use client";

import { motion } from "framer-motion";
import { breathing } from "@/lib/motion";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Just a moment." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <motion.div
        className="h-10 w-10 rounded-full bg-accent/60"
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={breathing}
      />
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}