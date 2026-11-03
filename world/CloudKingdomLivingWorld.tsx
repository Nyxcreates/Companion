"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

interface CloudKingdomProps {
  calm?: boolean;
}

interface Cloud {
  id: number;
  top: number;
  duration: number;
  delay: number;
  opacity: number;
  scale: number;
}

export function CloudKingdomLivingWorld({ calm = false }: CloudKingdomProps) {
  const prefersReducedMotion = useReducedMotion();
  const [clouds, setClouds] = useState<Cloud[]>([]);

  useEffect(() => {
    const list: Cloud[] = Array.from({ length: calm ? 5 : 10 }).map((_, i) => {
      const seed = i * 61.3;
      return {
        id: i,
        top: seededRandom(seed) * 70,
        duration: 50 + seededRandom(seed + 1) * 40,
        delay: seededRandom(seed + 2) * 20,
        opacity: 0.15 + seededRandom(seed + 3) * 0.2,
        scale: 0.8 + seededRandom(seed + 4) * 0.5,
      };
    });
    setClouds(list);
  }, [calm]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden select-none transition-opacity duration-1000 ${
        calm ? "opacity-35 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* === LAYER A: Golden sunrise / celestial sky (cinematic CSS — no generated image) === */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(250,204,21,0.22) 0%, transparent 50%), radial-gradient(ellipse at 20% 70%, rgba(244,114,182,0.16) 0%, transparent 50%), radial-gradient(ellipse at 80% 60%, rgba(168,85,247,0.14) 0%, transparent 45%), linear-gradient(180deg, #100d1a 0%, #1a1228 45%, #1c1025 75%, #0f0b18 100%)",
        }}
      />

      {/* Radiant golden sun bloom — anchored upper-center */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "350px",
          height: "350px",
          background:
            "radial-gradient(circle, rgba(250,204,21,0.28) 0%, rgba(251,146,60,0.16) 35%, rgba(168,85,247,0.08) 65%, transparent 80%)",
          filter: "blur(50px)",
        }}
      />

      {/* === LAYER B: Drifting cloud strata (5 independent layers) === */}
      {/* Layer 1 — deep background, very slow */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none"
        style={{ top: "12%", height: "200px", opacity: calm ? 0.15 : 0.32 }}
        animate={prefersReducedMotion || calm ? {} : { x: ["-8%", "8%", "-8%"] }}
        transition={{ duration: 80, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="h-full w-[140%] -translate-x-[20%]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(250,204,21,0.3) 0%, rgba(251,146,60,0.15) 45%, transparent 70%)",
            filter: "blur(45px)",
          }}
        />
      </motion.div>

      {/* Layer 2 — mid, pink-violet */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none"
        style={{ top: "32%", height: "150px", opacity: calm ? 0.12 : 0.28 }}
        animate={prefersReducedMotion || calm ? {} : { x: ["5%", "-8%", "5%"] }}
        transition={{ duration: 60, repeat: Infinity, ease: "easeInOut", delay: 10 }}
      >
        <div
          className="h-full w-[130%] -translate-x-[15%]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(244,114,182,0.35) 0%, rgba(168,85,247,0.2) 50%, transparent 72%)",
            filter: "blur(40px)",
          }}
        />
      </motion.div>

      {/* Layer 3 — near, golden */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none"
        style={{ top: "52%", height: "120px", opacity: calm ? 0.1 : 0.22 }}
        animate={prefersReducedMotion || calm ? {} : { x: ["-4%", "7%", "-4%"] }}
        transition={{ duration: 45, repeat: Infinity, ease: "easeInOut", delay: 18 }}
      >
        <div
          className="h-full w-[120%] -translate-x-[10%]"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(250,204,21,0.3), rgba(251,146,60,0.2), transparent)",
            filter: "blur(30px)",
          }}
        />
      </motion.div>

      {/* === LAYER C: Drifting cloud puffs (individual) === */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {clouds.map((c) => (
          <motion.div
            key={c.id}
            className="absolute"
            style={{
              top: `${c.top}%`,
              left: "-35%",
              opacity: c.opacity,
              transform: `scale(${c.scale})`,
            }}
            animate={
              prefersReducedMotion || calm
                ? {}
                : { x: ["0vw", "160vw"] }
            }
            transition={{
              duration: c.duration,
              delay: c.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            {/* Cloud puff (SVG ellipses) */}
            <svg viewBox="0 0 200 80" className="h-14 w-40" fill="none">
              <ellipse cx="100" cy="60" rx="90" ry="22" fill="rgba(255,255,255,0.25)" />
              <ellipse cx="80" cy="48" rx="55" ry="28" fill="rgba(255,255,255,0.22)" />
              <ellipse cx="120" cy="44" rx="45" ry="25" fill="rgba(255,255,255,0.2)" />
              <ellipse cx="100" cy="38" rx="38" ry="22" fill="rgba(255,255,255,0.18)" />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* === LAYER C: Distant floating sky islands with waterfalls === */}
      <div className="absolute pointer-events-none" style={{ right: "8%", top: "22%", opacity: calm ? 0.25 : 0.5 }}>
        <svg viewBox="0 0 140 100" className="h-24 w-36 sm:h-28 sm:w-44">
          {/* Island base */}
          <ellipse cx="70" cy="78" rx="62" ry="16" fill="rgba(22,15,35,0.8)" />
          <ellipse cx="70" cy="74" rx="58" ry="12" fill="rgba(35,25,55,0.75)" />
          {/* Terrain on island */}
          <path d="M20 74 C30 64 50 68 70 65 C90 62 110 66 120 74 Z" fill="rgba(45,32,70,0.7)" />
          {/* Castle / spire */}
          <rect x="58" y="48" width="24" height="26" fill="rgba(25,18,45,0.85)" />
          <polygon points="58,48 70,30 82,48" fill="rgba(20,14,40,0.9)" />
          {/* Tower spire */}
          <rect x="64" y="42" width="4" height="8" fill="rgba(30,22,55,0.85)" />
          <polygon points="62,42 66,34 70,42" fill="rgba(168,85,247,0.6)" />
          {/* Golden windows */}
          <rect x="62" y="55" width="6" height="5" fill="rgba(250,204,21,0.5)" rx="1" />
          <rect x="72" y="55" width="6" height="5" fill="rgba(250,204,21,0.5)" rx="1" />
          {/* Waterfall */}
          <path d="M26 74 C22 82 24 90 22 98" stroke="rgba(168,220,255,0.4)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M114 74 C118 82 116 90 118 98" stroke="rgba(168,220,255,0.4)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* Smaller distant floating island (left) */}
      <div className="absolute pointer-events-none" style={{ left: "6%", top: "38%", opacity: calm ? 0.2 : 0.38 }}>
        <svg viewBox="0 0 80 60" className="h-14 w-20">
          <ellipse cx="40" cy="48" rx="36" ry="10" fill="rgba(22,15,35,0.7)" />
          <path d="M12 48 C20 40 35 42 40 38 C50 35 60 40 68 48 Z" fill="rgba(35,25,55,0.65)" />
          <path d="M32 22 C28 30 30 36 40 36 C50 36 52 30 48 22 Z" fill="rgba(52,211,153,0.35)" />
        </svg>
      </div>

      {/* === LAYER C: Occasional soaring bird silhouettes === */}
      {!calm && !prefersReducedMotion && (
        <>
          <motion.svg
            viewBox="0 0 40 20"
            className="absolute h-3 w-6 pointer-events-none"
            style={{ top: "18%", left: "-5%" }}
            animate={{ x: ["0vw", "110vw"], y: [0, -15, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear", delay: 2 }}
            fill="rgba(200,180,255,0.5)"
          >
            <path d="M0 10 C8 4 15 6 20 10 C25 14 32 16 40 10" strokeWidth="1.5" stroke="rgba(200,180,255,0.5)" fill="none" />
          </motion.svg>
          <motion.svg
            viewBox="0 0 40 20"
            className="absolute h-2 w-5 pointer-events-none"
            style={{ top: "24%", left: "-3%" }}
            animate={{ x: ["0vw", "110vw"], y: [0, -10, 0] }}
            transition={{ duration: 28, repeat: Infinity, ease: "linear", delay: 9 }}
            fill="rgba(200,180,255,0.4)"
          >
            <path d="M0 10 C8 4 15 6 20 10 C25 14 32 16 40 10" strokeWidth="1.2" stroke="rgba(200,180,255,0.4)" fill="none" />
          </motion.svg>
        </>
      )}

      {/* === LAYER D: Foreground bottom vignette === */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(12,9,20,0.8) 100%)" }}
      />
    </div>
  );
}
