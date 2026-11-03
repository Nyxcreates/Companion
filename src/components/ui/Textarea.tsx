"use client";

import { forwardRef, type TextareaHTMLAttributes, useId } from "react";
import clsx from "clsx";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, className, id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const hasCustomResize = className?.includes("resize-") || className?.includes("resize");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm text-ink-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            "rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-ink-primary placeholder:text-ink-muted",
            !hasCustomResize && "resize-none",
            "transition-colors duration-200",
            "focus:outline-none focus:ring-2 focus:ring-accent-secondary/50 focus:border-accent-secondary/50",
            className
          )}
          {...props}
        />
        {helperText && <p className="text-sm text-ink-muted/80">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
