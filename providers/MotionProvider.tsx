"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** App-wide: when the OS asks for reduced motion, every Framer Motion transform/layout animation is disabled (opacity fades remain). */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}