"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-accent text-ink-primary shadow-card hover:shadow-glow hover:-translate-y-0.5 focus-visible:ring-accent",
  secondary:
    "bg-white/10 text-ink-primary hover:bg-white/15 hover:-translate-y-0.5 focus-visible:ring-white/30",
  outline:
    "border border-white/20 text-ink-primary hover:bg-white/5 hover:-translate-y-0.5 focus-visible:ring-white/30",
  ghost:
    "text-ink-secondary hover:text-ink-primary hover:bg-white/5 focus-visible:ring-white/20",
  danger:
    "bg-danger/90 text-ink-primary hover:bg-danger hover:-translate-y-0.5 focus-visible:ring-danger",
};

const sizeStyles: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-6 py-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";