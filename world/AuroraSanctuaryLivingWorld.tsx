"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

interface AuroraSanctuaryProps {
  calm?: boolean;
}

export function AuroraSanctuaryLivingWorld({ calm = false }: AuroraSanctuaryProps) {
  const prefersReducedMotion = useReducedMotion();
  const [snowflakes, setSnowflakes] = useState<
    { id: number; x: number; duration: number; delay: number; size: number; drift: number }[]
  >([]);

  useEffect(() => {
    const flakes = Array.from({ length: calm ? 14 : 28 }).map((_, i) => {
      const seed = i * 51.7;
      return {
        id: i,
        x: seededRandom(seed) * 94 + 3,
        duration: 8 + seededRandom(seed + 1) * 10,
        delay: seededRandom(seed + 2) * 8,
        size: 1.5 + seededRandom(seed + 3) * 2.5,
        drift: (seededRandom(seed + 4) - 0.5) * 40,
      };
    });
    setSnowflakes(flakes);
  }, [calm]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden select-none transition-opacity duration-1000 ${
        calm ? "opacity-35 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* === LAYER A: Arctic night gradient (cinematic fallback — no generated image yet) === */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(94,231,224,0.28) 0%, transparent 55%), radial-gradient(ellipse at 75% 35%, rgba(168,85,247,0.22) 0%, transparent 50%), radial-gradient(ellipse at 20% 50%, rgba(52,211,153,0.15) 0%, transparent 45%), linear-gradient(180deg, #020e14 0%, #041822 45%, #061820 75%, #020a0e 100%)",
        }}
      />

      {/* Starfield for arctic sky */}
      {Array.from({ length: 40 }).map((_, i) => {
        const seed = i * 77.3;
        const x = seededRandom(seed) * 100;
        const y = seededRandom(seed + 1) * 55;
        const size = 1 + seededRandom(seed + 2) * 1.5;
        const op = 0.3 + seededRandom(seed + 3) * 0.5;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white pointer-events-none"
            style={{ left: `${x}%`, top: `${y}%`, width: `${size}px`, height: `${size}px`, opacity: op }}
            animate={prefersReducedMotion || calm ? {} : { opacity: [op * 0.4, op, op * 0.4] }}
            transition={{ duration: 3 + seededRandom(seed + 4) * 4, delay: seededRandom(seed + 5) * 4, repeat: Infinity, ease: "easeInOut" }}
          />
        );
      })}

      {/* === LAYER B: Dancing aurora borealis curtains (3 layered ribbons) === */}
      {/* Ribbon 1 — emerald-cyan */}
      <motion.div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: "55%", opacity: calm ? 0.2 : 0.45 }}
        animate={
          prefersReducedMotion || calm
            ? {}
            : { x: ["-6%", "6%", "2%", "-6%"], scaleY: [1, 1.18, 0.94, 1] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="h-full w-[140%] -translate-x-[20%]"
          style={{
            background:
              "radial-gradient(ellipse at 45% 20%, rgba(94,231,224,0.45) 0%, rgba(52,211,153,0.25) 40%, transparent 65%)",
            filter: "blur(38px)",
          }}
        />
      </motion.div>

      {/* Ribbon 2 — violet-purple */}
      <motion.div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: "48%", opacity: calm ? 0.15 : 0.38 }}
        animate={
          prefersReducedMotion || calm
            ? {}
            : { x: ["5%", "-5%", "-2%", "5%"], scaleY: [0.9, 1.12, 1, 0.9] }
        }
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      >
        <div
          className="h-full w-[140%] -translate-x-[10%]"
          style={{
            background:
              "radial-gradient(ellipse at 65% 30%, rgba(168,85,247,0.5) 0%, rgba(124,92,255,0.3) 45%, transparent 70%)",
            filter: "blur(42px)",
          }}
        />
      </motion.div>

      {/* Ribbon 3 — teal accent */}
      <motion.div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: "38%", opacity: calm ? 0.12 : 0.3 }}
        animate={
          prefersReducedMotion || calm
            ? {}
            : { x: ["-3%", "8%", "0%", "-3%"], scaleY: [1.05, 0.9, 1.1, 1.05] }
        }
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 7 }}
      >
        <div
          className="h-full w-[130%] -translate-x-[15%]"
          style={{
            background:
              "radial-gradient(ellipse at 30% 40%, rgba(94,231,224,0.35) 0%, transparent 60%)",
            filter: "blur(35px)",
          }}
        />
      </motion.div>

      {/* === LAYER C: Mountain ridge silhouettes (depth) === */}
      <svg
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 right-0 h-52 w-full sm:h-64 opacity-65 pointer-events-none"
      >
        {/* Far distant ridge */}
        <path
          d="M0,300 C80,280 180,240 280,260 C380,280 440,230 540,245 C640,260 720,220 820,240 C920,260 1020,230 1100,245 C1150,252 1180,248 1200,250 L1200,400 L0,400 Z"
          fill="rgba(4,22,32,0.7)"
        />
        {/* Near foreground ridge */}
        <path
          d="M0,340 C120,310 220,280 340,300 C440,318 520,275 640,285 C760,295 860,270 980,285 C1080,298 1150,278 1200,282 L1200,400 L0,400 Z"
          fill="rgba(3,14,20,0.9)"
        />
        {/* Snow caps highlights */}
        <path d="M180,260 C195,248 210,252 225,260 Z" fill="rgba(255,255,255,0.25)" />
        <path d="M450,235 C468,222 484,228 500,237 Z" fill="rgba(255,255,255,0.22)" />
        <path d="M750,222 C768,210 783,216 798,222 Z" fill="rgba(255,255,255,0.2)" />
      </svg>

      {/* Frost-covered pine silhouettes */}
      <svg
        viewBox="0 0 1200 250"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-50 pointer-events-none sm:h-40"
      >
        {[60, 140, 220, 340, 460, 580, 720, 860, 980, 1100].map((x, i) => (
          <g key={i} transform={`translate(${x}, ${180 + (i % 3) * 14})`}>
            <polygon points="0,-70 -18,0 18,0" fill="rgba(3,18,28,0.9)" />
            <polygon points="0,-52 -14,0 14,0" fill="rgba(6,24,36,0.85)" transform="translate(0, -10)" />
            <rect x="-3" y="0" width="6" height="14" fill="rgba(5,18,26,0.9)" />
            {/* Snow on tip */}
            <ellipse cx="0" cy="-68" rx="4" ry="2" fill="rgba(220,240,255,0.35)" />
          </g>
        ))}
      </svg>

      {/* === LAYER C: Falling snow crystals === */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {snowflakes.map((flake) => (
          <motion.div
            key={flake.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${flake.x}%`,
              top: "-2%",
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              boxShadow: "0 0 4px rgba(200,240,255,0.8)",
            }}
            animate={
              prefersReducedMotion || calm
                ? { y: "110vh", opacity: 0.3 }
                : {
                    y: ["0vh", "110vh"],
                    x: [0, flake.drift * 0.5, flake.drift, flake.drift * 0.3],
                    opacity: [0, 0.8, 0.6, 0],
                  }
            }
            transition={{
              duration: flake.duration,
              delay: flake.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* === LAYER D: Foreground ice/snow ground reflection === */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/5 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(4,20,30,0.75) 100%)",
        }}
      />
    </div>
  );
}
