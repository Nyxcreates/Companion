"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

interface MoonlitSakuraProps {
  calm?: boolean;
}

interface Petal {
  id: number;
  x: number;
  duration: number;
  delay: number;
  size: number;
  drift: number;
  rotate: number;
}

export function MoonlitSakuraLivingWorld({ calm = false }: MoonlitSakuraProps) {
  const prefersReducedMotion = useReducedMotion();
  const [petals, setPetals] = useState<Petal[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const list: Petal[] = Array.from({ length: calm ? 14 : 30 }).map((_, i) => {
      const seed = i * 47.19;
      return {
        id: i,
        x: seededRandom(seed) * 94 + 3,
        duration: 10 + seededRandom(seed + 1) * 12,
        delay: seededRandom(seed + 2) * 8,
        size: 7 + seededRandom(seed + 3) * 7,
        drift: (seededRandom(seed + 4) - 0.5) * 80,
        rotate: seededRandom(seed + 5) * 360,
      };
    });
    setPetals(list);
  }, [calm]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden select-none transition-opacity duration-1000 ${
        calm ? "opacity-35 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* === LAYER A: Moonlit deep indigo base === */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 72% 22%, rgba(244,114,182,0.2) 0%, transparent 50%), radial-gradient(ellipse at 28% 72%, rgba(124,92,255,0.16) 0%, transparent 55%), linear-gradient(180deg, #100813 0%, #1e0b1d 45%, #1a0918 75%, #0e0610 100%)",
        }}
      />

      {/* Generated artwork backplate */}
      <img
        src="/worlds/moonlit-sakura.jpg"
        alt=""
        aria-hidden="true"
        onLoad={() => setImgLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1500 ${
          imgLoaded ? "opacity-50" : "opacity-0"
        }`}
        style={{ objectPosition: "center 30%" }}
      />

      {/* Moonlit atmospheric tint overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 70% 20%, rgba(244,114,182,0.1) 0%, transparent 45%), radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(14,6,16,0.72) 100%)",
        }}
      />

      {/* === LAYER B: Soft moon glow halo === */}
      <motion.div
        className="absolute right-[14%] top-[10%] h-40 w-40 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255,240,250,0.18) 0%, rgba(244,114,182,0.1) 40%, transparent 70%)",
          filter: "blur(28px)",
        }}
        animate={prefersReducedMotion || calm ? {} : { opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* === LAYER B: Slow atmospheric mist layer === */}
      {!prefersReducedMotion && !calm && (
        <motion.div
          className="absolute inset-x-0 bottom-0 h-48 pointer-events-none opacity-18"
          animate={{ x: ["-6%", "6%", "-6%"] }}
          transition={{ duration: 45, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="h-full w-[120%] -translate-x-[10%] bg-gradient-to-t from-violet-900/30 to-transparent blur-3xl" />
        </motion.div>
      )}

      {/* === LAYER C: Falling sakura petals === */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {petals.map((petal) => (
          <motion.div
            key={petal.id}
            className="absolute"
            style={{ left: `${petal.x}%`, top: "-4%" }}
            animate={
              prefersReducedMotion || calm
                ? { y: "115vh", opacity: 0 }
                : {
                    y: ["0vh", "115vh"],
                    x: [0, petal.drift * 0.5, petal.drift, petal.drift * 0.4],
                    rotate: [petal.rotate, petal.rotate + 180, petal.rotate + 360],
                    opacity: [0, 0.85, 0.7, 0],
                  }
            }
            transition={{
              duration: petal.duration,
              delay: petal.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Natural petal ellipse shape */}
            <svg viewBox="0 0 18 24" style={{ width: `${petal.size}px`, height: `${petal.size * 1.3}px` }}>
              <ellipse cx="9" cy="12" rx="8" ry="11" fill="rgba(244,114,182,0.78)" />
              <line x1="9" y1="2" x2="9" y2="22" stroke="rgba(255,200,220,0.4)" strokeWidth="0.8" />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* === LAYER C: Water ripples at bottom (pond reflection) === */}
      <div className="absolute bottom-0 inset-x-0 h-28 pointer-events-none opacity-40" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 border border-pink-300/25 rounded-full"
            style={{
              width: `${120 + i * 80}px`,
              height: `${30 + i * 18}px`,
              bottom: `${6 + i * 10}px`,
              transform: "translateX(-50%)",
            }}
            animate={
              prefersReducedMotion || calm
                ? {}
                : { opacity: [0.4, 0.1, 0.4], scaleX: [1, 1.06, 1] }
            }
            transition={{ duration: 4 + i * 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
          />
        ))}
      </div>

      {/* === LAYER C: Cherry blossom branch silhouette === */}
      <svg
        viewBox="0 0 220 200"
        className="absolute top-0 right-0 h-48 w-56 sm:h-56 sm:w-72 opacity-55 pointer-events-none"
        fill="none"
      >
        {/* Main branch */}
        <path d="M220 0 C190 40 160 60 120 90 C90 110 70 130 60 180" stroke="#4a1540" strokeWidth="6" strokeLinecap="round" />
        <path d="M160 60 C140 45 115 38 100 50" stroke="#4a1540" strokeWidth="4" strokeLinecap="round" />
        <path d="M120 90 C105 75 85 68 72 78" stroke="#4a1540" strokeWidth="3.5" strokeLinecap="round" />
        {/* Decorative blossoms on branch */}
        {[
          [108, 48, 8],
          [94, 57, 7],
          [73, 72, 7],
          [145, 60, 7],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(244,114,182,0.55)" />
        ))}
      </svg>

      {/* === LAYER D: Foreground bottom vignette === */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(14,6,16,0.78) 100%)" }}
      />
    </div>
  );
}
