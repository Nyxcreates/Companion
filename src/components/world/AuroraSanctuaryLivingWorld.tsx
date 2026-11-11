"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";
import { useWorldScheduler } from "@/lib/world/useWorldScheduler";

interface AuroraSanctuaryProps {
  calm?: boolean;
}

export function AuroraSanctuaryLivingWorld({ calm = false }: AuroraSanctuaryProps) {
  const { isTabVisible, isMobile, isMomentActive, momentCount, prefersReducedMotion } =
    useWorldScheduler({ minIntervalSeconds: 24, maxIntervalSeconds: 54, momentDurationMs: 6500 });

  const [snowflakes, setSnowflakes] = useState<
    { id: number; x: number; duration: number; delay: number; size: number; drift: number }[]
  >([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const flakeCount = isMobile ? (calm ? 8 : 16) : (calm ? 14 : 28);
    const flakes = Array.from({ length: flakeCount }).map((_, i) => {
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
  }, [calm, isMobile]);

  const shouldAnimate = !prefersReducedMotion && !calm && isTabVisible;

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

      {/* Optional real artwork backplate if dropped in public/worlds/aurora-sanctuary.jpg */}
      <img
        src="/worlds/aurora-sanctuary.jpg"
        alt=""
        aria-hidden="true"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgLoaded(false)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1500 pointer-events-none ${
          imgLoaded ? "opacity-50" : "opacity-0"
        }`}
        style={{ objectPosition: "center 30%" }}
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
            animate={!shouldAnimate ? {} : { opacity: [op * 0.4, op, op * 0.4] }}
            transition={{ duration: 3 + seededRandom(seed + 4) * 4, delay: seededRandom(seed + 5) * 4, repeat: Infinity, ease: "easeInOut" }}
          />
        );
      })}

      {/* Polar star (North Star) */}
      <div className="absolute top-[12%] left-[48%] pointer-events-none">
        <div className="relative">
          <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_12px_#5ee7e0]" />
          <div className="absolute -inset-2 rounded-full bg-cyan-300/30 blur-sm animate-pulse" />
        </div>
      </div>

      {/* === LAYER B: Dancing aurora borealis curtains (3 layered ribbons) === */}
      {/* Ribbon 1 — emerald-cyan */}
      <motion.div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: "55%", opacity: calm ? 0.2 : 0.45 }}
        animate={
          !shouldAnimate
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
          !shouldAnimate
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

      {/* Ribbon 3 — glacial teal accent */}
      <motion.div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: "38%", opacity: calm ? 0.12 : 0.3 }}
        animate={
          !shouldAnimate
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

      {/* === LAYER C: Mountain ridge silhouettes (3 depth tiers) === */}
      <svg
        viewBox="0 0 1200 420"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 right-0 h-56 w-full sm:h-72 opacity-75 pointer-events-none"
      >
        {/* Tier 1: Far distant alpine ridge with cold atmospheric mist */}
        <path
          d="M0,280 C100,240 180,210 260,230 C340,250 420,190 520,215 C620,240 700,180 800,205 C900,230 1000,195 1100,215 C1150,225 1180,220 1200,225 L1200,420 L0,420 Z"
          fill="rgba(5,28,40,0.55)"
        />
        {/* Far snow highlights */}
        <polygon points="520,215 500,235 540,235" fill="rgba(200,240,255,0.2)" />
        <polygon points="800,205 780,225 820,225" fill="rgba(200,240,255,0.2)" />

        {/* Tier 2: Mid-ground jagged mountain range */}
        <path
          d="M0,320 C80,290 180,250 280,270 C380,290 440,240 540,255 C640,270 720,230 820,250 C920,270 1020,240 1100,255 C1150,262 1180,258 1200,260 L1200,420 L0,420 Z"
          fill="rgba(3,18,26,0.8)"
        />
        {/* Mid snow caps */}
        <path d="M180,270 C195,258 210,262 225,270 Z" fill="rgba(255,255,255,0.3)" />
        <path d="M450,245 C468,232 484,238 500,247 Z" fill="rgba(255,255,255,0.28)" />
        <path d="M750,232 C768,220 783,226 798,232 Z" fill="rgba(255,255,255,0.25)" />

        {/* Tier 3: Near foreground icy crag ridge */}
        <path
          d="M0,360 C120,330 220,300 340,320 C440,338 520,295 640,305 C760,315 860,290 980,305 C1080,318 1150,298 1200,302 L1200,420 L0,420 Z"
          fill="rgba(2,11,16,0.95)"
        />
        {/* Ice glints and crystalline sparkles */}
        <circle cx="205" cy="262" r="1.8" fill="#ffffff" opacity="0.9" />
        <circle cx="475" cy="238" r="2.0" fill="#5ee7e0" opacity="0.95" />
        <circle cx="775" cy="226" r="1.8" fill="#a855f7" opacity="0.9" />
        <circle cx="980" cy="305" r="1.5" fill="#5ee7e0" opacity="0.85" />
      </svg>

      {/* Dynamic ice sparkles on mountain slopes */}
      {shouldAnimate && (
        <div className="absolute bottom-16 inset-x-0 h-32 pointer-events-none" aria-hidden="true">
          {[18, 32, 48, 62, 75, 88].map((pos, idx) => (
            <motion.div
              key={idx}
              className="absolute w-1.5 h-1.5 rounded-full bg-cyan-100 shadow-[0_0_8px_#5ee7e0]"
              style={{ left: `${pos}%`, bottom: `${15 + (idx % 3) * 18}%` }}
              animate={{ opacity: [0, 0.95, 0], scale: [0.4, 1.5, 0.4] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: idx * 0.5, ease: "easeInOut" }}
            />
          ))}
        </div>
      )}

      {/* === Timed Rare Moment (every 20-60s): Intense auroral flare surge across peaks === */}
      {isMomentActive && !prefersReducedMotion && isTabVisible && (
        <div key={momentCount} className="absolute inset-0 pointer-events-none z-20">
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 30%, rgba(94,231,224,0.45) 0%, rgba(168,85,247,0.35) 45%, transparent 75%)",
              filter: "blur(30px)",
            }}
            initial={{ opacity: 0, scaleY: 0.8 }}
            animate={{ opacity: [0, 0.85, 0.4, 0.7, 0], scaleY: [0.8, 1.25, 1.1, 1.3, 0.9] }}
            transition={{ duration: 6, ease: "easeInOut" }}
          />
          {/* Intense burst of ice sparkle glints */}
          <div className="absolute bottom-20 inset-x-0 flex justify-around">
            {[1, 2, 3, 4, 5, 6].map((k) => (
              <motion.div
                key={k}
                className="w-2 h-2 rounded-full bg-white shadow-[0_0_12px_#5ee7e0]"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.8, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, delay: k * 0.25, ease: "easeOut" }}
              />
            ))}
          </div>
        </div>
      )}

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
              !shouldAnimate
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
