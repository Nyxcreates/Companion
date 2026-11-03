"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useMotionValue, useSpring, useReducedMotion, type MotionValue } from "framer-motion";

interface ParallaxContextValue {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

const ParallaxContext = createContext<ParallaxContextValue | null>(null);

/**
 * Tracks pointer position as a normalized -0.5..0.5 offset from center,
 * exposed as spring-smoothed motion values so layers can read them
 * without triggering React re-renders. Disabled entirely on coarse
 * pointers (touch/tablet) and under prefers-reduced-motion — those
 * visitors get the ambient environment with no mouse parallax, exactly
 * as if the values simply never move from zero.
 */
export function ParallaxProvider({ children }: { children: ReactNode }) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 40, damping: 20, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 40, damping: 20, mass: 0.6 });
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) return;

    const handleMove = (event: MouseEvent) => {
      rawX.set(event.clientX / window.innerWidth - 0.5);
      rawY.set(event.clientY / window.innerHeight - 0.5);
    };

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [prefersReducedMotion, rawX, rawY]);

  return <ParallaxContext.Provider value={{ x, y }}>{children}</ParallaxContext.Provider>;
}

export function useParallax(): ParallaxContextValue {
  const ctx = useContext(ParallaxContext);
  if (!ctx) {
    throw new Error("useParallax must be used within a ParallaxProvider");
  }
  return ctx;
}