"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fadeIn, scaleIn } from "@/lib/motion";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** "md" (default, max-w-md) matches every existing modal's width unchanged. "lg" (max-w-2xl) is for content that needs real room — e.g. the journal composer, which shouldn't feel like a cramped form. */
  size?: "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <button
            aria-label="Close modal"
            className="absolute inset-0 bg-surface-primary/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`glass-card relative w-full ${SIZE_CLASSES[size]} p-6 shadow-modal`}
          >
            {title && <h2 className="mb-4 font-display text-lg font-semibold text-ink-primary">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}