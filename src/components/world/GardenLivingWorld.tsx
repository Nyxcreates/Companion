"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";
import { useWorldScheduler } from "@/lib/world/useWorldScheduler";

interface GardenLivingWorldProps {
  interactive?: boolean;
  calm?: boolean;
  seedGrown?: boolean;
  onSelectObject?: (objectId: string, label: string, description: string) => void;
  activeObjectId?: string | null;
}

interface Firefly {
  id: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  size: number;
}

interface Petal {
  id: number;
  x: number;
  duration: number;
  delay: number;
  size: number;
  drift: number;
}

export function GardenLivingWorld({
  interactive = false,
  calm = false,
  seedGrown = false,
  onSelectObject,
  activeObjectId,
}: GardenLivingWorldProps) {
  const { isTabVisible, isMobile, isMomentActive, momentCount, prefersReducedMotion } =
    useWorldScheduler({ minIntervalSeconds: 24, maxIntervalSeconds: 52, momentDurationMs: 6500 });

  const [fireflies, setFireflies] = useState<Firefly[]>([]);
  const [petals, setPetals] = useState<Petal[]>([]);
  const [isBlooming, setIsBlooming] = useState(seedGrown);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => setIsBlooming(seedGrown), [seedGrown]);

  useEffect(() => {
    const ffCount = isMobile ? (calm ? 6 : 12) : (calm ? 10 : 22);
    const ffs: Firefly[] = Array.from({ length: ffCount }).map((_, i) => {
      const seed = i * 43.19;
      return {
        id: i,
        x: seededRandom(seed) * 85 + 5,
        y: seededRandom(seed + 1) * 70 + 18,
        duration: 4 + seededRandom(seed + 2) * 5,
        delay: seededRandom(seed + 3) * 4,
        size: 2 + seededRandom(seed + 4) * 2.5,
      };
    });
    setFireflies(ffs);

    const petalCount = isMobile ? (calm ? 5 : 9) : (calm ? 8 : 18);
    const pts: Petal[] = Array.from({ length: petalCount }).map((_, i) => {
      const seed = i * 67.4;
      return {
        id: i,
        x: seededRandom(seed) * 90 + 5,
        duration: 12 + seededRandom(seed + 1) * 10,
        delay: seededRandom(seed + 2) * 8,
        size: 6 + seededRandom(seed + 3) * 5,
        drift: (seededRandom(seed + 4) - 0.5) * 60,
      };
    });
    setPetals(pts);
  }, [calm, isMobile]);

  const shouldAnimate = !prefersReducedMotion && !calm && isTabVisible;

  const handleObjectClick = (objectId: string, label: string, description: string) => {
    if (interactive && onSelectObject) {
      if (objectId === "growing-seed" || objectId === "blooming-flower") setIsBlooming(true);
      onSelectObject(objectId, label, description);
    }
  };

  return (
    <div
      className={`absolute inset-0 overflow-hidden select-none transition-opacity duration-1000 ${
        calm ? "opacity-35 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* === LAYER A: Background base gradient === */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(52,211,153,0.22) 0%, transparent 50%), radial-gradient(ellipse at 75% 65%, rgba(244,114,182,0.14) 0%, transparent 50%), linear-gradient(180deg, #041210 0%, #091f18 45%, #061a12 75%, #040d09 100%)",
        }}
      />

      {/* Generated artwork backplate */}
      <img
        src="/worlds/enchanted-garden.jpg"
        alt=""
        aria-hidden="true"
        onLoad={() => setImgLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1500 ${
          imgLoaded ? "opacity-50" : "opacity-0"
        }`}
        style={{ objectPosition: "center 40%" }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(4,18,10,0.75) 100%)",
        }}
      />

      {/* === LAYER B: Atmospheric fog / sky mist drift === */}
      {!prefersReducedMotion && !calm && (
        <motion.div
          className="absolute inset-x-0 top-0 h-56 pointer-events-none opacity-20"
          animate={{ x: ["-8%", "8%", "-8%"] }}
          transition={{ duration: 50, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="h-full w-[130%] -translate-x-[15%] rounded-full bg-gradient-to-b from-emerald-800/40 to-transparent blur-3xl" />
        </motion.div>
      )}

      {/* === LAYER C: Drifting flower petals from sky === */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {petals.map((petal) => (
          <motion.div
            key={petal.id}
            className="absolute"
            style={{ left: `${petal.x}%`, top: "-3%" }}
            animate={
              !shouldAnimate
                ? { y: "110vh", opacity: 0 }
                : {
                    y: ["0vh", "115vh"],
                    x: [0, petal.drift * 0.6, petal.drift, petal.drift * 0.5],
                    rotate: [0, 90, 200, 360],
                    opacity: [0, 0.75, 0.65, 0],
                  }
            }
            transition={{
              duration: petal.duration,
              delay: petal.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <svg viewBox="0 0 14 14" style={{ width: `${petal.size}px`, height: `${petal.size}px` }}>
              <ellipse cx="7" cy="7" rx="6" ry="3.5" fill="rgba(244,114,182,0.75)" />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* === LAYER C: Rolling hill silhouettes (depth) === */}
      <svg
        viewBox="0 0 1200 380"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 right-0 h-44 w-full opacity-55 sm:h-60"
      >
        <path
          d="M0,270 C280,200 500,300 800,230 C1000,185 1150,250 1200,240 L1200,380 L0,380 Z"
          fill="rgba(5,30,22,0.75)"
        />
        <path
          d="M0,310 C240,260 450,340 750,285 C950,245 1100,305 1200,295 L1200,380 L0,380 Z"
          fill="rgba(4,22,15,0.92)"
        />
      </svg>

      {/* === LAYER C: Stream === */}
      <svg
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        className={`absolute bottom-0 left-0 right-0 h-24 w-full ${
          interactive ? "cursor-pointer group" : ""
        }`}
        onClick={() =>
          handleObjectClick(
            "garden-stream",
            "The Flowing Timetable Stream",
            "Water finds its own natural path around stones. Your schedule works the same way: it gives your day shape without forcing rigid, unforgiving blocks."
          )
        }
        role={interactive ? "button" : undefined}
        aria-label={interactive ? "Inspect Garden Stream" : undefined}
        tabIndex={interactive ? 0 : -1}
      >
        <path
          d="M0,250 C320,240 450,280 700,260 C880,245 950,270 1000,260 L1000,300 L0,300 Z"
          fill="rgba(14,165,233,0.18)"
        />
        <path
          d="M0,260 C300,255 470,290 720,270 C890,260 970,285 1000,275 L1000,300 L0,300 Z"
          fill="rgba(94,231,224,0.28)"
        />
      </svg>

      {/* === LAYER C: Fireflies === */}
      <div className="absolute inset-0" aria-hidden="true">
        {fireflies.map((ff) => (
          <motion.div
            key={ff.id}
            className="absolute rounded-full"
            style={{
              left: `${ff.x}%`,
              top: `${ff.y}%`,
              width: `${ff.size}px`,
              height: `${ff.size}px`,
              backgroundColor: "#a7f3d0",
              boxShadow: "0 0 8px #34d399, 0 0 18px rgba(52,211,153,0.5)",
            }}
            animate={
              !shouldAnimate
                ? { opacity: 0.45, x: 0, y: 0 }
                : {
                    x: [0, ff.id % 2 === 0 ? 18 : -18, 0],
                    y: [0, -20, 0],
                    opacity: [0.05, 0.95, 0.05],
                  }
            }
            transition={{
              duration: ff.duration,
              delay: ff.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* === LAYER C: Butterfly === */}
      <motion.div
        className={`absolute left-[35%] top-[38%] sm:left-[42%] sm:top-[33%] ${
          interactive ? "cursor-pointer group" : ""
        }`}
        onClick={() =>
          handleObjectClick(
            "butterfly",
            "The Adaptive Butterfly",
            "Progress isn't a straight line. When plans change or an unexpected day happens, Nikki adapts with you gracefully, without guilt or shame."
          )
        }
        role={interactive ? "button" : undefined}
        aria-label={interactive ? "Inspect Butterfly" : undefined}
        tabIndex={interactive ? 0 : -1}
        animate={
          prefersReducedMotion || calm
            ? {}
            : { x: [0, 26, 10, -18, 0], y: [0, -18, -32, -10, 0] }
        }
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative flex items-center justify-center">
          <svg viewBox="0 0 36 28" className="h-6 w-8 text-pink-300" fill="currentColor"
               style={{ filter: "drop-shadow(0 0 7px rgba(244,114,182,0.7))" }}>
            <path d="M18 14 C12 6 4 6 2 12 C0 18 10 22 18 16 C26 22 36 18 34 12 C32 6 24 6 18 14 Z" opacity="0.85" />
            <circle cx="18" cy="14" r="2" fill="#ffffff" />
          </svg>
          {interactive && (
            <span className="absolute -top-6 whitespace-nowrap rounded-full border border-pink-400/40 bg-slate-900/80 px-2 py-0.5 text-[10px] text-pink-200 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
              ✦ Butterfly
            </span>
          )}
        </div>
      </motion.div>

      {/* === LAYER C: Goal Blossom (central foreground focal point) === */}
      <div
        className={`absolute bottom-[14%] left-[18%] sm:left-[24%] ${
          interactive ? "cursor-pointer group" : ""
        }`}
        onClick={() =>
          handleObjectClick(
            "blooming-flower",
            "The Goal Blossom",
            "Every big dream begins like a seed in the soil. Through small, steady daily actions, it sprouts roots, grows leaves, and blossoms into tangible achievement."
          )
        }
        role={interactive ? "button" : undefined}
        aria-label={interactive ? "Inspect Goal Blossom" : undefined}
        tabIndex={interactive ? 0 : -1}
      >
        <div className="relative flex flex-col items-center">
          <motion.div
            className="absolute -inset-5 rounded-full blur-2xl pointer-events-none"
            animate={
              prefersReducedMotion ? {} : { opacity: [0.3, 0.7, 0.3] }
            }
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                activeObjectId === "blooming-flower" || isBlooming
                  ? "radial-gradient(circle, rgba(52,211,153,0.5) 0%, rgba(251,191,36,0.3) 55%, transparent 75%)"
                  : "radial-gradient(circle, rgba(52,211,153,0.22) 0%, transparent 65%)",
            }}
          />
          <svg viewBox="0 0 60 90" className="relative z-10 h-24 w-16 sm:h-28 sm:w-20" fill="none">
            <motion.path
              d="M30 90 Q28 50 30 35"
              stroke="#10b981" strokeWidth="3.5" strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            <motion.path d="M29 65 Q12 58 16 48 Q26 50 29 62" fill="#34d399"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }} />
            <motion.path d="M31 54 Q48 48 44 38 Q34 40 31 51" fill="#34d399"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }} />
            <motion.g
              animate={isBlooming ? { scale: [1, 1.14, 1], rotate: [0, 4, -4, 0] } : { scale: 1 }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <circle cx="30" cy="28" r="8" fill="#fbbf24" style={{ filter: "drop-shadow(0 0 8px #fbbf24)" }} />
              <circle cx="22" cy="22" r="6" fill="#f472b6" opacity="0.9" />
              <circle cx="38" cy="22" r="6" fill="#f472b6" opacity="0.9" />
              <circle cx="22" cy="34" r="6" fill="#f472b6" opacity="0.9" />
              <circle cx="38" cy="34" r="6" fill="#f472b6" opacity="0.9" />
              <circle cx="30" cy="18" r="6" fill="#f472b6" opacity="0.9" />
              <circle cx="30" cy="38" r="6" fill="#f472b6" opacity="0.9" />
              <circle cx="30" cy="28" r="4" fill="#ffffff" />
            </motion.g>
          </svg>
          {interactive && (
            <span className="mt-1 whitespace-nowrap rounded-full border border-emerald-400/40 bg-slate-900/80 px-2 py-0.5 text-[10px] text-emerald-200 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
              ✦ Goal Blossom
            </span>
          )}
        </div>
      </div>

      {/* Swaying canopy leaves in the gentle breeze */}
      {shouldAnimate && (
        <div className="absolute top-0 right-0 w-64 h-36 pointer-events-none opacity-40 overflow-hidden">
          <motion.svg
            viewBox="0 0 200 120"
            className="w-full h-full"
            animate={{ rotate: [-2, 3, -2], x: [0, 4, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "top right" }}
          >
            <path d="M120 0 Q150 50 190 70 Q140 60 110 30 Z" fill="#059669" opacity="0.8" />
            <path d="M150 0 Q170 40 200 45 Q160 35 140 20 Z" fill="#10b981" opacity="0.7" />
            <path d="M80 0 Q110 40 140 60 Q105 45 75 20 Z" fill="#34d399" opacity="0.6" />
          </motion.svg>
        </div>
      )}

      {/* === Timed Rare Moment (every 20-60s): Iridescent butterfly fluttering across meadow === */}
      {isMomentActive && !prefersReducedMotion && isTabVisible && (
        <div key={momentCount} className="absolute inset-0 pointer-events-none z-20">
          <motion.div
            className="absolute"
            initial={{ left: "-5%", top: "62%", opacity: 0 }}
            animate={{
              left: ["-5%", "35%", "70%", "105%"],
              top: ["62%", "40%", "50%", "32%"],
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 6, ease: "easeInOut" }}
          >
            <motion.div
              animate={{ y: [0, -8, 4, -6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg viewBox="0 0 40 30" className="h-7 w-9 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]">
                <motion.g
                  animate={{ scaleX: [1, 0.2, 1] }}
                  transition={{ duration: 0.22, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: "20px 15px" }}
                >
                  {/* Left wings */}
                  <ellipse cx="14" cy="11" rx="9" ry="6" fill="#38bdf8" />
                  <ellipse cx="12" cy="18" rx="7" ry="5" fill="#34d399" />
                  {/* Right wings */}
                  <ellipse cx="26" cy="11" rx="9" ry="6" fill="#38bdf8" />
                  <ellipse cx="28" cy="18" rx="7" ry="5" fill="#34d399" />
                  {/* Body & glow core */}
                  <ellipse cx="20" cy="15" rx="1.8" ry="6" fill="#fbbf24" />
                </motion.g>
              </svg>
            </motion.div>
          </motion.div>
        </div>
      )}

      {/* === LAYER D: Foreground bottom gradient === */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(4,14,9,0.7) 100%)" }}
      />
    </div>
  );
}
