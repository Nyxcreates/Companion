"use client";

import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

type StarVariant = "twinkle" | "fade" | "drift" | "still";

interface Star {
  id: number;
  left: number;
  top: number;
  size: number;
  baseOpacity: number;
  duration: number;
  delay: number;
  variant: StarVariant;
  driftX: number;
  driftY: number;
}

function pickVariant(seed: number): StarVariant {
  const r = seededRandom(seed);
  if (r < 0.4) return "twinkle";
  if (r < 0.65) return "fade";
  if (r < 0.8) return "drift";
  return "still";
}

function variantClassName(variant: StarVariant): string {
  const base = "absolute rounded-full bg-white";
  switch (variant) {
    case "twinkle":
      return `${base} animate-star-twinkle`;
    case "fade":
      return `${base} animate-star-fade`;
    case "drift":
      return `${base} animate-star-drift`;
    default:
      return base;
  }
}

function generateStars(
  count: number,
  seedOffset: number,
  sizeRange: [number, number],
  opacityRange: [number, number]
): Star[] {
  return Array.from({ length: count }).map((_, i) => {
    const seed = seedOffset + i * 13.37;
    return {
      id: seedOffset + i,
      left: seededRandom(seed) * 100,
      top: seededRandom(seed + 1) * 100,
      size: sizeRange[0] + seededRandom(seed + 2) * (sizeRange[1] - sizeRange[0]),
      baseOpacity: opacityRange[0] + seededRandom(seed + 3) * (opacityRange[1] - opacityRange[0]),
      duration: 4 + seededRandom(seed + 4) * 7,
      delay: seededRandom(seed + 5) * 8,
      variant: pickVariant(seed + 6),
      driftX: (seededRandom(seed + 7) - 0.5) * 6,
      driftY: (seededRandom(seed + 8) - 0.5) * 6,
    };
  });
}

interface StarFieldProps {
  density: "far" | "near";
}

/**
 * Stars are generated only after mount (inside useEffect), never
 * during render. This means the server-rendered HTML and the very
 * first client render both produce the same empty container — there
 * is nothing for React to reconcile, so hydration cannot mismatch
 * regardless of any floating-point difference between environments.
 * The star field then fades in once populated.
 */
export function StarField({ density }: StarFieldProps) {
  const [stars, setStars] = useState<Star[] | null>(null);

  useEffect(() => {
    if (density === "far") {
      setStars([
        ...generateStars(70, 10, [1, 1.5], [0.12, 0.3]),
        ...generateStars(35, 600, [1.3, 1.9], [0.28, 0.45]),
      ]);
    } else {
      setStars(generateStars(16, 1400, [2, 3.2], [0.55, 0.9]));
    }
  }, [density]);

  if (!stars) {
    return <div className="absolute inset-0" />;
  }

  return (
    <div className="absolute inset-0 animate-fade-in">
      {stars.map((star) => (
        <span
          key={star.id}
          className={variantClassName(star.variant)}
          style={
            {
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              animationDuration: star.variant === "still" ? undefined : `${star.duration}s`,
              animationDelay: star.variant === "still" ? undefined : `${star.delay}s`,
              opacity: star.variant === "still" ? star.baseOpacity : undefined,
              "--star-opacity": star.baseOpacity,
              "--drift-x": `${star.driftX}px`,
              "--drift-y": `${star.driftY}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}