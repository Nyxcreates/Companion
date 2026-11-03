"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

interface CosmicStoryBackgroundProps {
  sceneIndex?: number; // 0 to 7
  sceneId?: string;
}

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

const SCENE_PALETTES = [
  // 0: The Beginning - deep darkness, emerging dawn
  {
    gradient: "radial-gradient(circle at 50% 50%, rgba(124,92,255,0.08), transparent 60%), linear-gradient(180deg, #020208 0%, #060514 60%, #08071b 100%)",
    accent: "rgba(124, 92, 255, 0.15)",
  },
  // 1: Reality of Life - scattered dusk
  {
    gradient: "radial-gradient(circle at 30% 40%, rgba(180,122,255,0.12), transparent 55%), radial-gradient(circle at 75% 65%, rgba(94,231,224,0.08), transparent 50%), linear-gradient(180deg, #04040e 0%, #0a091e 60%, #0c0b22 100%)",
    accent: "rgba(180, 122, 255, 0.2)",
  },
  // 2: Arrival of Companion - radiant connection
  {
    gradient: "radial-gradient(circle at 50% 45%, rgba(94,231,224,0.18), transparent 50%), radial-gradient(circle at 20% 80%, rgba(124,92,255,0.16), transparent 55%), linear-gradient(180deg, #050512 0%, #0d0c24 55%, #100f2e 100%)",
    accent: "rgba(94, 231, 224, 0.25)",
  },
  // 3: Life Understood - memory constellation
  {
    gradient: "radial-gradient(circle at 65% 35%, rgba(124,92,255,0.18), transparent 50%), radial-gradient(circle at 35% 70%, rgba(94,231,224,0.12), transparent 50%), linear-gradient(180deg, #060515 0%, #0c0b26 60%, #0d0c28 100%)",
    accent: "rgba(124, 92, 255, 0.2)",
  },
  // 4: Dreams Become Steps - path of starlight
  {
    gradient: "radial-gradient(circle at 50% 25%, rgba(255,209,102,0.12), transparent 45%), radial-gradient(circle at 50% 80%, rgba(124,92,255,0.16), transparent 55%), linear-gradient(180deg, #060514 0%, #0b0a22 60%, #0e0d29 100%)",
    accent: "rgba(255, 209, 102, 0.2)",
  },
  // 5: Space to Begin Again - sanctuary emerald & deep indigo
  {
    gradient: "radial-gradient(circle at 50% 50%, rgba(52,211,153,0.12), transparent 55%), radial-gradient(circle at 80% 20%, rgba(94,231,224,0.08), transparent 45%), linear-gradient(180deg, #030612 0%, #060e20 60%, #071224 100%)",
    accent: "rgba(52, 211, 153, 0.2)",
  },
  // 6: Your World, Your Way - personal universe horizon
  {
    gradient: "radial-gradient(circle at 50% 65%, rgba(180,122,255,0.22), transparent 50%), radial-gradient(circle at 20% 30%, rgba(94,231,224,0.14), transparent 50%), linear-gradient(180deg, #060515 0%, #0d0c28 60%, #121035 100%)",
    accent: "rgba(180, 122, 255, 0.25)",
  },
  // 7: Enter Companion - full constellation culmination
  {
    gradient: "radial-gradient(circle at 50% 40%, rgba(124,92,255,0.24), transparent 55%), radial-gradient(circle at 80% 20%, rgba(94,231,224,0.18), transparent 50%), radial-gradient(circle at 20% 80%, rgba(255,209,102,0.12), transparent 45%), linear-gradient(180deg, #070618 0%, #0e0d2a 55%, #141238 100%)",
    accent: "rgba(94, 231, 224, 0.3)",
  },
];

export function CosmicStoryBackground({ sceneIndex = 0, sceneId }: CosmicStoryBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();
  const [stars, setStars] = useState<Star[]>([]);
  const palette = SCENE_PALETTES[Math.min(sceneIndex, SCENE_PALETTES.length - 1)];

  useEffect(() => {
    // Deterministic procedural generation after mount to avoid hydration mismatch
    const generated: Star[] = Array.from({ length: 65 }).map((_, i) => {
      const seed = i * 27.81;
      return {
        id: i,
        x: seededRandom(seed) * 100,
        y: seededRandom(seed + 1) * 100,
        size: 1 + seededRandom(seed + 2) * 2,
        opacity: 0.2 + seededRandom(seed + 3) * 0.7,
        duration: 3 + seededRandom(seed + 4) * 6,
        delay: seededRandom(seed + 5) * 5,
      };
    });
    setStars(generated);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* 1. Base Gradient Canvas with smooth transition */}
      <motion.div
        className="absolute inset-0"
        animate={{ background: palette.gradient }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />

      {/* 2. Soft Ambient Aura Pulse */}
      <motion.div
        className="absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full blur-[110px]"
        animate={{
          background: `radial-gradient(ellipse at center, ${palette.accent} 0%, transparent 70%)`,
          scale: prefersReducedMotion ? 1 : [0.95, 1.05, 0.95],
          opacity: [0.6, 0.85, 0.6],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* 3. Starfield with subtle twinkling */}
      <div className="absolute inset-0">
        {stars.map((star) => (
          <motion.span
            key={star.id}
            className="absolute rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
            }}
            animate={
              prefersReducedMotion
                ? { opacity: star.opacity }
                : {
                    opacity: [star.opacity * 0.3, star.opacity, star.opacity * 0.3],
                    scale: [0.9, 1.15, 0.9],
                  }
            }
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* 4. Subtle Vignette & Depth Mask */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 50%, transparent 55%, rgba(2, 2, 8, 0.6) 100%)",
        }}
      />
    </div>
  );
}
