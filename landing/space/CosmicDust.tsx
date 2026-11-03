"use client";

import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

type DustVariant = "diagonal" | "vertical" | "horizontal";

interface DustParticle {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  variant: DustVariant;
}

const VARIANTS: DustVariant[] = ["diagonal", "vertical", "horizontal"];

function generateDust(): DustParticle[] {
  return Array.from({ length: 20 }).map((_, i) => {
    const seed = 2000 + i * 9.21;
    return {
      id: i,
      left: seededRandom(seed) * 100,
      top: seededRandom(seed + 1) * 100,
      size: 1 + seededRandom(seed + 2) * 1.5,
      duration: 22 + seededRandom(seed + 3) * 24,
      delay: seededRandom(seed + 4) * 12,
      variant: VARIANTS[i % VARIANTS.length],
    };
  });
}

/**
 * Same hydration-safety pattern as StarField: particles are generated
 * only after mount, so server and first-client render match exactly
 * (an empty container) and there's nothing for React to reconcile.
 */
export function CosmicDust() {
  const [particles, setParticles] = useState<DustParticle[] | null>(null);

  useEffect(() => {
    setParticles(generateDust());
  }, []);

  if (!particles) {
    return <div className="absolute inset-0" />;
  }

  return (
    <div className="absolute inset-0">
      {particles.map((p) => (
        <span
          key={p.id}
          className={`absolute rounded-full bg-accent-secondary/40 animate-dust-${p.variant}`}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}