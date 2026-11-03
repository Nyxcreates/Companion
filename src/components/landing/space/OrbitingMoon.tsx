"use client";

import clsx from "clsx";
import { useReducedMotion } from "framer-motion";
import { MoonBody } from "./Moon";
import { ORBIT_BOX_CLASSNAME, ORBIT_BOX_STYLE } from "./OrbitPath";

/**
 * Carries the moon slowly around the existing orbit path (roughly one
 * lap every 3.5 minutes) — celestial mechanics, not a loading spinner.
 * Positioned within the exact same box as OrbitPath so it visually
 * traces the faint ring drawn there.
 */
export function OrbitingMoon() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={ORBIT_BOX_CLASSNAME} style={ORBIT_BOX_STYLE} aria-hidden="true">
      <div
        className={clsx(
          "absolute h-9 w-9 sm:h-12 sm:w-12 md:h-14 md:w-14",
          !prefersReducedMotion && "animate-moon-orbit"
        )}
        style={{
          transform: "translate(-50%, -50%)",
          ...(prefersReducedMotion ? { left: "97%", top: "50%" } : {}),
        }}
      >
        <MoonBody className="h-full w-full" />
      </div>
    </div>
  );
}