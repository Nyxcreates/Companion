"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { toastSlide } from "@/lib/motion";

export type ToastVariant = "info" | "success" | "warning" | "danger";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const variantBorder: Record<ToastVariant, string> = {
  info: "border-accent-secondary/30",
  success: "border-success/40",
  warning: "border-warning/40",
  danger: "border-danger/40",
};

const variantDot: Record<ToastVariant, string> = {
  info: "bg-accent-secondary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              variants={toastSlide}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={clsx(
                "glass-card pointer-events-auto flex items-center gap-3 border px-4 py-3 text-sm text-ink-primary",
                variantBorder[toast.variant]
              )}
            >
              <span className={clsx("h-2 w-2 shrink-0 rounded-full", variantDot[toast.variant])} aria-hidden="true" />
              <span>{toast.message}</span>
              <button
                onClick={() => dismiss(toast.id)}
                className="ml-1 text-ink-muted transition-colors hover:text-ink-primary"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}