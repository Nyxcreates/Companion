import type { Variants, Transition } from "framer-motion";

/**
 * Companion motion guidelines.
 *
 * Everything should feel smooth, calm and premium — never instant,
 * never harsh. Page/element transitions live here as the single
 * source of truth so every component animates consistently.
 *
 * - Durations: 200–500ms (per ANIMATIONS.md)
 * - Easing: soft, standard curves — no linear, no bounce on UI chrome
 * - Idle/ambient motion (breathing, floating) is slow and continuous
 */

export const duration = {
  fast: 0.2,
  base: 0.3,
  slow: 0.5,
};

export const ease = {
  standard: [0.4, 0, 0.2, 1],
  gentle: [0.25, 0.1, 0.25, 1],
} as const;

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base, ease: ease.standard } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.standard } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.standard } },
  exit: { opacity: 0, y: 8, transition: { duration: duration.fast, ease: ease.standard } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: duration.base, ease: ease.standard } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: duration.fast, ease: ease.standard } },
};

export const toastSlide: Variants = {
  hidden: { opacity: 0, y: -12, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: duration.fast, ease: ease.standard } },
  exit: { opacity: 0, y: -8, scale: 0.96, transition: { duration: duration.fast, ease: ease.standard } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/** Slow, continuous idle motion — for the character and ambient elements. */
export const breathing: Transition = {
  duration: 4,
  repeat: Infinity,
  ease: "easeInOut",
};