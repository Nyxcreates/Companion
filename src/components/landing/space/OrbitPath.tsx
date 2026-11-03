import type { CSSProperties } from "react";

/** Shared box so OrbitingMoon travels along exactly the ellipse drawn here. */
export const ORBIT_BOX_CLASSNAME =
  "absolute right-[-2%] top-[2%] h-[210px] w-[260px] sm:h-[280px] sm:w-[340px] md:h-[380px] md:w-[460px]";

export const ORBIT_BOX_STYLE: CSSProperties = { transform: "rotate(-12deg)" };

/** A faint, tilted orbit line near the planet — its brightness breathes very slowly, never a technical diagram. */
export function OrbitPath() {
  return (
    <div
      className={`${ORBIT_BOX_CLASSNAME} animate-orbit-glow pointer-events-none rounded-full border border-white/10`}
      style={ORBIT_BOX_STYLE}
      aria-hidden="true"
    />
  );
}