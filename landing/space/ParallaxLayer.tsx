"use client";

import { motion, useTransform } from "framer-motion";
import type { ReactNode } from "react";
import { useParallax } from "./ParallaxProvider";

interface ParallaxLayerProps {
  children: ReactNode;
  depth: number; // max pixel offset at full pointer travel — deeper layers use smaller numbers
  className?: string;
}

/** Wraps a slice of the scene so it drifts a few pixels with the pointer, discoverable rather than obvious. */
export function ParallaxLayer({ children, depth, className }: ParallaxLayerProps) {
  const { x, y } = useParallax();
  const tx = useTransform(x, (v) => v * depth);
  const ty = useTransform(y, (v) => v * depth);

  return (
    <motion.div className={className} style={{ x: tx, y: ty }}>
      {children}
    </motion.div>
  );
}