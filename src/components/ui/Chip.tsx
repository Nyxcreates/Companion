"use client";

import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Toggle chip for multi-select onboarding questions — reusable anywhere a "pick a few of these" pattern is needed. */
export function Chip({ selected, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={clsx(
        "rounded-full border px-4 py-2 text-sm transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/50",
        selected
          ? "border-accent-secondary/60 bg-accent-secondary/15 text-ink-primary"
          : "border-white/15 bg-white/5 text-ink-secondary hover:border-white/25 hover:text-ink-primary",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}