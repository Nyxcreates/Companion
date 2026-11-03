"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

interface MidnightAcademiaProps {
  calm?: boolean;
}

export function MidnightAcademiaLivingWorld({ calm = false }: MidnightAcademiaProps) {
  const prefersReducedMotion = useReducedMotion();
  const [dustMotes, setDustMotes] = useState<
    { id: number; x: number; y: number; size: number; duration: number; driftX: number }[]
  >([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const motes = Array.from({ length: calm ? 12 : 26 }).map((_, i) => {
      const seed = i * 29.3;
      return {
        id: i,
        x: seededRandom(seed) * 88 + 6,
        y: seededRandom(seed + 1) * 80 + 10,
        size: 1.5 + seededRandom(seed + 2) * 2.2,
        duration: 8 + seededRandom(seed + 3) * 8,
        driftX: (seededRandom(seed + 4) - 0.5) * 24,
      };
    });
    setDustMotes(motes);
  }, [calm]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden select-none transition-opacity duration-1000 ${
        calm ? "opacity-35 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* === LAYER A: Deep mahogany library base === */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 28% 68%, rgba(251,191,36,0.18) 0%, transparent 50%), radial-gradient(ellipse at 72% 28%, rgba(180,83,9,0.16) 0%, transparent 48%), linear-gradient(180deg, #0e0905 0%, #1a120b 50%, #120c07 80%, #0a0703 100%)",
        }}
      />

      {/* Generated artwork backplate */}
      <img
        src="/worlds/midnight-academia.jpg"
        alt=""
        aria-hidden="true"
        onLoad={() => setImgLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1500 ${
          imgLoaded ? "opacity-48" : "opacity-0"
        }`}
        style={{ objectPosition: "center 20%" }}
      />

      {/* Warm candlelight overlay tint */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 75%, rgba(251,146,60,0.12) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(14,9,5,0.68) 100%)",
        }}
      />

      {/* === LAYER B: Rain streaks on window (atmospheric) === */}
      <div className="absolute inset-0 opacity-15 pointer-events-none" aria-hidden="true">
        {[8, 22, 40, 58, 75, 88].map((left, idx) => (
          <motion.div
            key={idx}
            className="absolute w-px bg-gradient-to-b from-transparent via-amber-100/50 to-transparent"
            style={{ left: `${left}%`, height: "70px" }}
            animate={
              prefersReducedMotion || calm
                ? {}
                : { y: ["-12vh", "115vh"], opacity: [0, 0.7, 0] }
            }
            transition={{
              duration: 2.2 + (idx % 4) * 0.4,
              repeat: Infinity,
              delay: idx * 0.45,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Slightly thicker secondary rain streaks */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden="true">
        {[15, 35, 52, 68, 82].map((left, idx) => (
          <motion.div
            key={idx}
            className="absolute w-px bg-gradient-to-b from-transparent via-slate-300/30 to-transparent"
            style={{ left: `${left}%`, height: "45px" }}
            animate={
              prefersReducedMotion || calm
                ? {}
                : { y: ["-8vh", "112vh"] }
            }
            transition={{
              duration: 3 + idx * 0.3,
              repeat: Infinity,
              delay: idx * 0.6 + 0.2,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* === LAYER B: Slow candle light flicker (atmospheric) === */}
      {!prefersReducedMotion && !calm && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            bottom: "8%",
            left: "15%",
            width: "200px",
            height: "200px",
            background:
              "radial-gradient(circle, rgba(251,191,36,0.3) 0%, rgba(251,146,60,0.15) 40%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(20px)",
          }}
          animate={{ opacity: [0.6, 0.9, 0.7, 1, 0.6], scale: [1, 1.06, 0.97, 1.04, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* === LAYER C: Drifting golden dust motes === */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {dustMotes.map((mote) => (
          <motion.div
            key={mote.id}
            className="absolute rounded-full bg-amber-200"
            style={{
              left: `${mote.x}%`,
              top: `${mote.y}%`,
              width: `${mote.size}px`,
              height: `${mote.size}px`,
              boxShadow: "0 0 6px rgba(251,191,36,0.65)",
            }}
            animate={
              prefersReducedMotion || calm
                ? { opacity: 0.3 }
                : {
                    y: [0, -32, 0],
                    x: [0, mote.driftX, 0],
                    opacity: [0.05, 0.7, 0.05],
                    scale: [0.8, 1.2, 0.8],
                  }
            }
            transition={{
              duration: mote.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: mote.id * 0.25,
            }}
          />
        ))}
      </div>

      {/* === LAYER C: Candle flame (decorative SVG) === */}
      {!calm && (
        <div className="absolute bottom-[12%] left-[18%] sm:left-[22%] pointer-events-none">
          <motion.svg
            viewBox="0 0 24 40"
            className="h-14 w-8"
            animate={prefersReducedMotion ? {} : { scaleY: [1, 1.08, 0.96, 1.04, 1], scaleX: [1, 0.97, 1.03, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "bottom center" }}
          >
            {/* Wax */}
            <rect x="8" y="28" width="8" height="12" rx="1" fill="rgba(248,245,235,0.85)" />
            {/* Wick */}
            <line x1="12" y1="28" x2="12" y2="24" stroke="#555" strokeWidth="1" />
            {/* Inner flame (blue base) */}
            <path d="M12 24 C10 20 9 14 12 8 C15 14 14 20 12 24 Z" fill="rgba(100,180,255,0.55)" />
            {/* Outer flame (golden) */}
            <path d="M12 24 C9 18 8 10 12 4 C16 10 15 18 12 24 Z" fill="rgba(251,191,36,0.85)" />
            {/* Tip flicker */}
            <ellipse cx="12" cy="5" rx="2" ry="3" fill="rgba(255,255,255,0.7)" />
          </motion.svg>
        </div>
      )}

      {/* === LAYER D: Bottom floor/desk gradient === */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(10,7,3,0.8) 100%)" }}
      />
    </div>
  );
}
