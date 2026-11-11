"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";
import { useWorldScheduler } from "@/lib/world/useWorldScheduler";

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
  const { isTabVisible, isMobile, isMomentActive, momentCount, prefersReducedMotion } =
    useWorldScheduler({ minIntervalSeconds: 22, maxIntervalSeconds: 52, momentDurationMs: 7000 });

  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const cloudCount = isMobile ? (calm ? 3 : 6) : (calm ? 5 : 10);
    const list: Cloud[] = Array.from({ length: cloudCount }).map((_, i) => {
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
  }, [calm, isMobile]);

  const shouldAnimate = !prefersReducedMotion && !calm && isTabVisible;

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

      {/* Optional real artwork backplate if dropped in public/worlds/cloud-kingdom.jpg */}
      <img
        src="/worlds/cloud-kingdom.jpg"
        alt=""
        aria-hidden="true"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgLoaded(false)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1500 pointer-events-none ${
          imgLoaded ? "opacity-50" : "opacity-0"
        }`}
        style={{ objectPosition: "center 30%" }}
      />

      {/* Radiant golden sun bloom — anchored upper-center */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "380px",
          height: "380px",
          background:
            "radial-gradient(circle, rgba(250,204,21,0.32) 0%, rgba(251,146,60,0.18) 35%, rgba(168,85,247,0.08) 65%, transparent 80%)",
          filter: "blur(50px)",
        }}
      />

      {/* Volumetric sun rays (crepuscular light shafts) fanning down */}
      {shouldAnimate && (
        <motion.div
          className="absolute inset-0 pointer-events-none overflow-hidden opacity-30"
          animate={{ opacity: [0.2, 0.4, 0.2], x: [-10, 10, -10] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 1000 600" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="rayGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#fde047" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points="500,0 200,600 320,600" fill="url(#rayGrad)" />
            <polygon points="500,0 420,600 580,600" fill="url(#rayGrad)" />
            <polygon points="500,0 680,600 800,600" fill="url(#rayGrad)" />
            <polygon points="500,0 80,600 170,600" fill="url(#rayGrad)" />
            <polygon points="500,0 830,600 920,600" fill="url(#rayGrad)" />
          </svg>
        </motion.div>
      )}

      {/* === LAYER B: Drifting cloud strata (3 independent layers) === */}
      {/* Layer 1 — deep background, very slow */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none"
        style={{ top: "12%", height: "200px", opacity: calm ? 0.15 : 0.32 }}
        animate={!shouldAnimate ? {} : { x: ["-8%", "8%", "-8%"] }}
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
        animate={!shouldAnimate ? {} : { x: ["5%", "-8%", "5%"] }}
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
        animate={!shouldAnimate ? {} : { x: ["-4%", "7%", "-4%"] }}
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
              !shouldAnimate
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

      {/* === LAYER C: Parallax floating sky islands with waterfalls & citadel === */}
      {/* Island 1: Distant Citadel Island (right) */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ right: "8%", top: "20%", opacity: calm ? 0.25 : 0.55 }}
        animate={
          !shouldAnimate
            ? {}
            : { x: [0, -18, 0], y: [0, -10, 0] }
        }
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 140 100" className="h-24 w-36 sm:h-28 sm:w-44">
          <ellipse cx="70" cy="78" rx="62" ry="16" fill="rgba(22,15,35,0.8)" />
          <ellipse cx="70" cy="74" rx="58" ry="12" fill="rgba(35,25,55,0.75)" />
          <path d="M20 74 C30 64 50 68 70 65 C90 62 110 66 120 74 Z" fill="rgba(45,32,70,0.7)" />
          <rect x="58" y="48" width="24" height="26" fill="rgba(25,18,45,0.85)" />
          <polygon points="58,48 70,30 82,48" fill="rgba(20,14,40,0.9)" />
          <rect x="64" y="42" width="4" height="8" fill="rgba(30,22,55,0.85)" />
          <polygon points="62,42 66,34 70,42" fill="rgba(168,85,247,0.6)" />
          <rect x="62" y="55" width="6" height="5" fill="rgba(250,204,21,0.5)" rx="1" />
          <rect x="72" y="55" width="6" height="5" fill="rgba(250,204,21,0.5)" rx="1" />
          <path d="M26 74 C22 82 24 90 22 98" stroke="rgba(168,220,255,0.4)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M114 74 C118 82 116 90 118 98" stroke="rgba(168,220,255,0.4)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </motion.div>

      {/* Island 2: Mid-ground floating sanctuary island (left) */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ left: "6%", top: "36%", opacity: calm ? 0.2 : 0.45 }}
        animate={
          !shouldAnimate
            ? {}
            : { x: [0, 16, 0], y: [0, -14, 0] }
        }
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        <svg viewBox="0 0 100 70" className="h-16 w-24 sm:h-20 sm:w-28">
          <ellipse cx="50" cy="54" rx="42" ry="12" fill="rgba(22,15,35,0.75)" />
          <path d="M15 54 C25 44 42 46 50 42 C62 38 75 44 85 54 Z" fill="rgba(35,25,55,0.7)" />
          <rect x="46" y="30" width="8" height="14" fill="rgba(28,20,48,0.85)" />
          <polygon points="44,30 50,20 56,30" fill="rgba(250,204,21,0.7)" />
          <path d="M40 26 C35 34 37 40 48 40" stroke="rgba(52,211,153,0.45)" strokeWidth="2" fill="none" />
        </svg>
      </motion.div>

      {/* Island 3: Small floating crystal crag (center-bottom) */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ left: "45%", top: "58%", opacity: calm ? 0.15 : 0.35 }}
        animate={
          !shouldAnimate
            ? {}
            : { x: [0, -10, 0], y: [0, -8, 0] }
        }
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 5 }}
      >
        <svg viewBox="0 0 60 45" className="h-10 w-14">
          <ellipse cx="30" cy="35" rx="24" ry="7" fill="rgba(20,13,32,0.8)" />
          <polygon points="30,12 24,35 36,35" fill="rgba(244,114,182,0.6)" />
          <polygon points="22,18 18,35 26,35" fill="rgba(168,85,247,0.5)" />
          <polygon points="38,20 34,35 42,35" fill="rgba(250,204,21,0.5)" />
        </svg>
      </motion.div>

      {/* === LAYER C: Occasional soaring bird silhouettes === */}
      {shouldAnimate && (
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

      {/* === Timed Rare Moment (every 20-60s): Magnificent mythical winged silhouette soaring across the clouds === */}
      {isMomentActive && !prefersReducedMotion && isTabVisible && (
        <div key={momentCount} className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          <motion.div
            className="absolute"
            initial={{ left: "-20%", top: "28%", opacity: 0 }}
            animate={{
              left: ["-20%", "110%"],
              top: ["28%", "18%"],
              opacity: [0, 0.6, 0.75, 0],
            }}
            transition={{ duration: 7, ease: "easeInOut" }}
          >
            {/* Soaring winged creature */}
            <svg viewBox="0 0 120 60" className="h-12 w-24 sm:h-16 sm:w-32 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]">
              {/* Wings */}
              <motion.path
                d="M15 30 C35 10 50 12 60 25 C70 12 85 10 105 30 C85 32 68 40 60 35 C52 40 35 32 15 30 Z"
                fill="rgba(240, 220, 255, 0.75)"
                animate={{ scaleY: [1, 0.6, 1.15, 1] }}
                transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
                style={{ transformOrigin: "60px 30px" }}
              />
              {/* Torso & Tail stream */}
              <ellipse cx="60" cy="30" rx="4" ry="12" fill="rgba(250, 204, 21, 0.9)" />
              <path d="M60 42 C58 50 62 55 60 62" stroke="rgba(250, 204, 21, 0.7)" strokeWidth="1.5" fill="none" />
            </svg>
          </motion.div>
        </div>
      )}

      {/* === LAYER D: Foreground bottom vignette === */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(12,9,20,0.8) 100%)" }}
      />
    </div>
  );
}
