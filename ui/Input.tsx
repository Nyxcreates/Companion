"use client";

import { forwardRef, type InputHTMLAttributes, useId } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm text-ink-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={clsx(
            "rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-ink-primary placeholder:text-ink-muted",
            "focus:outline-none focus:ring-2 focus:ring-accent-secondary/50 focus:border-accent-secondary/50",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-danger/60 focus:ring-danger/40 focus:border-danger/60",
            className
          )}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-danger">
            {error}
          </p>
        )}
        {!error && helperText && <p className="text-sm text-ink-muted/80">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";