"use client";

import { motion } from "framer-motion";
import { Button } from "./Button";
import { fadeIn } from "@/lib/motion";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong.",
  message = "Let's try that again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center gap-3 py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-2xl">🙁</div>
      <h3 className="font-display text-lg font-medium text-ink-primary">{title}</h3>
      <p className="text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      )}
    </motion.div>
  );
}