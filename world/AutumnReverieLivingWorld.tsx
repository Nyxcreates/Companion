"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

interface AutumnReverieProps {
  calm?: boolean;
}

interface Leaf {
  id: number;
  x: number;
  duration: number;
  delay: number;
  size: number;
  color: string;
  drift: number;
  spin: number;
}

export function AutumnReverieLivingWorld({ calm = false }: AutumnReverieProps) {
  const prefersReducedMotion = useReducedMotion();
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const colors = ["#f97316", "#fbbf24", "#ea580c", "#e11d48", "#dc2626", "#fb923c"];
    const list: Leaf[] = Array.from({ length: calm ? 12 : 26 }).map((_, i) => {
      const seed = i * 39.8;
      return {
        id: i,
        x: seededRandom(seed) * 92 + 4,
        duration: 10 + seededRandom(seed + 1) * 12,
        delay: seededRandom(seed + 2) * 8,
        size: 10 + seededRandom(seed + 3) * 9,
        color: colors[i % colors.length],
        drift: (seededRandom(seed + 4) - 0.5) * 90,
        spin: seededRandom(seed + 5) * 360,
      };
    });
    setLeaves(list);
  }, [calm]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden select-none transition-opacity duration-1000 ${
        calm ? "opacity-35 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* === LAYER A: Warm golden twilight gradient === */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(251,146,60,0.22) 0%, transparent 55%), radial-gradient(ellipse at 78% 22%, rgba(244,63,94,0.15) 0%, transparent 48%), radial-gradient(ellipse at 20% 70%, rgba(234,88,12,0.18) 0%, transparent 50%), linear-gradient(180deg, #150a04 0%, #1e1008 45%, #200f07 75%, #130804 100%)",
        }}
      />

      {/* Generated artwork backplate */}
      <img
        src="/worlds/autumn-reverie.jpg"
        alt=""
        aria-hidden="true"
        onLoad={() => setImgLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1500 ${
          imgLoaded ? "opacity-50" : "opacity-0"
        }`}
        style={{ objectPosition: "center 35%" }}
      />

      {/* Warm dusk tint overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 70%, rgba(251,146,60,0.1) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 32%, rgba(18,9,4,0.7) 100%)",
        }}
      />

      {/* === LAYER B: Atmospheric twilight glow on horizon === */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          bottom: "30%",
          height: "200px",
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(251,146,60,0.22) 0%, rgba(244,63,94,0.1) 40%, transparent 70%)",
          filter: "blur(30px)",
          opacity: calm ? 0.3 : 0.6,
        }}
        animate={prefersReducedMotion || calm ? {} : { opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* === LAYER B: Warm mist over hills === */}
      {!prefersReducedMotion && !calm && (
        <motion.div
          className="absolute inset-x-0 pointer-events-none opacity-22"
          style={{ bottom: "20%", height: "120px" }}
          animate={{ x: ["-5%", "5%", "-5%"] }}
          transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="h-full w-[120%] -translate-x-[10%] bg-gradient-to-t from-orange-900/25 to-transparent blur-3xl" />
        </motion.div>
      )}

      {/* === LAYER C: Tumbling maple leaves === */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {leaves.map((leaf) => (
          <motion.div
            key={leaf.id}
            className="absolute"
            style={{ left: `${leaf.x}%`, top: "-4%" }}
            animate={
              prefersReducedMotion || calm
                ? { y: "115vh", opacity: 0 }
                : {
                    y: ["0vh", "115vh"],
                    x: [0, leaf.drift * 0.4, leaf.drift, leaf.drift * 0.3],
                    rotate: [leaf.spin, leaf.spin + 200, leaf.spin + 420],
                    opacity: [0, 0.9, 0.75, 0],
                  }
            }
            transition={{
              duration: leaf.duration,
              delay: leaf.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Maple leaf shape via SVG */}
            <svg
              viewBox="0 0 20 20"
              style={{ width: `${leaf.size}px`, height: `${leaf.size}px` }}
              fill={leaf.color}
              opacity="0.85"
            >
              <path d="M10 1 C8 4 4 4 3 6 C5 7 4 9 5 11 C3 11 1 13 2 15 C5 14 6 16 8 17 L9 14 L10 17 L11 14 L12 17 C14 16 15 14 18 15 C19 13 17 11 15 11 C16 9 15 7 17 6 C16 4 12 4 10 1 Z" />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* === LAYER C: Hillside silhouettes (depth) === */}
      <svg
        viewBox="0 0 1200 380"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 right-0 h-44 w-full sm:h-56 opacity-65 pointer-events-none"
      >
        <path
          d="M0,290 C200,255 350,300 550,270 C720,248 850,280 1000,260 C1100,248 1160,258 1200,255 L1200,380 L0,380 Z"
          fill="rgba(12,6,3,0.78)"
        />
        <path
          d="M0,330 C180,300 320,340 500,315 C680,292 820,325 1000,308 C1100,298 1160,310 1200,305 L1200,380 L0,380 Z"
          fill="rgba(8,4,2,0.9)"
        />
      </svg>

      {/* === LAYER C: Warm glowing lanterns === */}
      {!calm && (
        <>
          {[
            { x: "20%", y: "55%", size: 14 },
            { x: "55%", y: "62%", size: 11 },
            { x: "78%", y: "50%", size: 13 },
          ].map((lantern, i) => (
            <div key={i} className="absolute pointer-events-none" style={{ left: lantern.x, top: lantern.y }}>
              <motion.div
                className="rounded-full"
                style={{
                  width: `${lantern.size * 3}px`,
                  height: `${lantern.size * 3}px`,
                  background: "radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(251,146,60,0.3) 45%, transparent 70%)",
                  filter: "blur(8px)",
                }}
                animate={prefersReducedMotion ? {} : { opacity: [0.6, 1, 0.7, 0.9, 0.6] }}
                transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          ))}
        </>
      )}

      {/* === LAYER D: Bottom depth gradient === */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(12,6,3,0.82) 100%)" }}
      />
    </div>
  );
}
