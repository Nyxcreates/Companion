"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { CharacterPlaceholder } from "@/components/character/CharacterPlaceholder";
import { fadeIn } from "@/lib/motion";

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/** Generic "nothing here yet" state — per UI_SCREEN_REFERENCE.md, never a blank page. */
export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
    >
      {icon ?? <CharacterPlaceholder size={64} />}
      <div>
        <h3 className="font-display text-lg font-medium text-ink-primary">{title}</h3>
        {message && <p className="mt-1 text-sm text-ink-muted">{message}</p>}
      </div>
      {action}
    </motion.div>
  );
}