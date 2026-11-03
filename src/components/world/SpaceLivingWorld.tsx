"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

interface SpaceLivingWorldProps {
  interactive?: boolean;
  calm?: boolean;
  onSelectObject?: (objectId: string, label: string, description: string) => void;
  activeObjectId?: string | null;
}

interface StarNode {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  depth: number;
}

export function SpaceLivingWorld({
  interactive = false,
  calm = false,
  onSelectObject,
  activeObjectId,
}: SpaceLivingWorldProps) {
  const prefersReducedMotion = useReducedMotion();
  const [stars, setStars] = useState<StarNode[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const generated: StarNode[] = Array.from({ length: calm ? 40 : 70 }).map((_, i) => {
      const seed = i * 31.415;
      const depthTier = i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 3;
      return {
        id: i,
        x: seededRandom(seed) * 100,
        y: seededRandom(seed + 1) * 100,
        size: depthTier === 1 ? 1.0 : depthTier === 2 ? 1.8 : 2.8,
        opacity: depthTier === 1 ? 0.25 : depthTier === 2 ? 0.5 : 0.8,
        duration: 3 + seededRandom(seed + 2) * 5,
        delay: seededRandom(seed + 3) * 4,
        depth: depthTier,
      };
    });
    setStars(generated);
  }, [calm]);

  const constellationPoints = [
    { x: 38, y: 28, label: "Conversation" },
    { x: 52, y: 22, label: "Memory" },
    { x: 68, y: 32, label: "Capsule" },
    { x: 60, y: 46, label: "Garden" },
    { x: 44, y: 42, label: "Heart" },
  ];

  const handleObjectClick = (objectId: string, label: string, description: string) => {
    if (interactive && onSelectObject) {
      onSelectObject(objectId, label, description);
    }
  };

  return (
    <div
      className={`absolute inset-0 overflow-hidden select-none transition-opacity duration-1000 ${
        calm ? "opacity-35 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* === LAYER A: Background Painting === */}
      {/* Fallback gradient always shown until image loads */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 70% 15%, rgba(94,231,224,0.18) 0%, transparent 40%), radial-gradient(ellipse at 25% 60%, rgba(124,92,255,0.22) 0%, transparent 50%), linear-gradient(180deg, #03030f 0%, #080721 45%, #0d0b30 75%, #070715 100%)",
        }}
      />

      {/* Generated artwork backplate */}
      <img
        src="/worlds/cosmic-dream.jpg"
        alt=""
        aria-hidden="true"
        onLoad={() => setImgLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1500 ${
          imgLoaded ? "opacity-55" : "opacity-0"
        }`}
        style={{ objectPosition: "center 30%" }}
      />

      {/* Subtle cinematic vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(3,3,15,0.7) 100%)",
        }}
      />

      {/* Atmospheric depth: nebula haze layered in front of art */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 75% 20%, rgba(94,231,224,0.08) 0%, transparent 35%), radial-gradient(ellipse at 20% 70%, rgba(124,92,255,0.12) 0%, transparent 45%)",
        }}
      />

      {/* === LAYER B: Atmospheric slow camera drift === */}
      {!prefersReducedMotion && !calm && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ scale: [1, 1.025, 1], x: [0, 6, 0] }}
          transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(ellipse at 60% 30%, rgba(168,85,247,0.06) 0%, transparent 50%)",
          }}
        />
      )}

      {/* === LAYER C: Twinkling Stars (3 depth tiers) === */}
      <div className="absolute inset-0" aria-hidden="true">
        {stars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              boxShadow:
                star.depth === 3
                  ? "0 0 5px 1px rgba(255,255,255,0.7)"
                  : star.depth === 2
                  ? "0 0 3px rgba(200,220,255,0.5)"
                  : "none",
            }}
            animate={
              prefersReducedMotion || calm
                ? { opacity: star.opacity }
                : {
                    opacity: [star.opacity * 0.3, star.opacity, star.opacity * 0.3],
                    scale: star.depth === 3 ? [1, 1.3, 1] : [1, 1, 1],
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

      {/* === LAYER C: Large Luminous Crescent Moon === */}
      <motion.div
        className={`absolute right-[8%] top-[8%] sm:right-[12%] sm:top-[10%] ${
          interactive ? "cursor-pointer group" : ""
        }`}
        onClick={() =>
          handleObjectClick(
            "crescent-moon",
            "Luminous Crescent Moon",
            "A serene guide in the cosmic quiet. The moon reflects the steady continuity of your days, glowing regardless of whether a day went smoothly or not."
          )
        }
        role={interactive ? "button" : undefined}
        aria-label={interactive ? "Inspect Crescent Moon" : undefined}
        tabIndex={interactive ? 0 : -1}
        animate={
          prefersReducedMotion || calm
            ? {}
            : { y: [0, -7, 0] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative h-24 w-24 sm:h-32 sm:w-32">
          {/* Lunar halo glow — stronger when selected */}
          <motion.div
            className="absolute -inset-6 rounded-full blur-3xl pointer-events-none"
            animate={
              prefersReducedMotion ? {} : { opacity: [0.4, 0.7, 0.4] }
            }
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                activeObjectId === "crescent-moon"
                  ? "radial-gradient(circle, rgba(94,231,224,0.55) 0%, rgba(200,200,255,0.2) 55%, transparent 75%)"
                  : "radial-gradient(circle, rgba(94,231,224,0.3) 0%, rgba(124,92,255,0.18) 55%, transparent 75%)",
            }}
          />
          {/* Crescent SVG */}
          <svg viewBox="0 0 100 100" className="relative z-10 h-full w-full drop-shadow-[0_0_16px_rgba(200,230,255,0.7)]">
            <defs>
              <linearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="55%" stopColor="#dde8f0" />
                <stop offset="100%" stopColor="#a8d8f0" stopOpacity="0.85" />
              </linearGradient>
              <mask id="cMask">
                <rect width="100" height="100" fill="white" />
                <circle cx="62" cy="38" r="37" fill="black" />
              </mask>
            </defs>
            <circle cx="50" cy="50" r="40" fill="url(#moonGrad)" mask="url(#cMask)" />
          </svg>
          {interactive && (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan-400/40 bg-slate-900/80 px-2 py-0.5 text-[10px] text-cyan-200 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
              ✦ Crescent Moon
            </span>
          )}
        </div>
      </motion.div>

      {/* === LAYER C: Memory Constellation === */}
      <div
        className={`absolute left-[10%] top-[20%] sm:left-[14%] sm:top-[18%] ${
          interactive ? "cursor-pointer group" : ""
        }`}
        onClick={() =>
          handleObjectClick(
            "constellation",
            "The Memory Constellation",
            "Nikki connects the thoughts, recurring goals, and values you share into a gentle constellation—helping her remember what matters to you without forcing you to repeat yourself."
          )
        }
        role={interactive ? "button" : undefined}
        aria-label={interactive ? "Inspect Memory Constellation" : undefined}
        tabIndex={interactive ? 0 : -1}
      >
        <svg viewBox="0 0 100 100" className="h-40 w-40 sm:h-52 sm:w-52" fill="none">
          <motion.polyline
            points="38,28 52,22 68,32 60,46 44,42 38,28 68,32"
            stroke="rgba(124,92,255,0.45)"
            strokeWidth="1.1"
            strokeDasharray="3 3"
            animate={prefersReducedMotion || calm ? {} : { strokeDashoffset: [0, -18] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          {constellationPoints.map((pt, i) => (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r="2.8" fill="#ffffff" style={{ filter: "drop-shadow(0 0 5px #5ee7e0)" }} />
              <circle cx={pt.x} cy={pt.y} r="6" stroke="rgba(94,231,224,0.35)" strokeWidth="0.8" />
            </g>
          ))}
        </svg>
        {interactive && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-violet-400/40 bg-slate-900/80 px-2 py-0.5 text-[10px] text-violet-200 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
            ✦ Memory Constellation
          </span>
        )}
      </div>

      {/* === LAYER C: Capsule Voyager === */}
      <motion.div
        className={`absolute ${interactive ? "cursor-pointer group" : ""}`}
        style={{ top: "65%", left: "5%" }}
        onClick={() =>
          handleObjectClick(
            "spaceship",
            "The Memory Capsule Voyager",
            "Like a voyager carrying messages across time, Memory Capsules hold milestone reflections and heartfelt notes for you to open whenever you wish."
          )
        }
        role={interactive ? "button" : undefined}
        aria-label={interactive ? "Inspect Memory Capsule Voyager" : undefined}
        tabIndex={interactive ? 0 : -1}
        animate={
          prefersReducedMotion || calm
            ? { x: "15vw" }
            : { x: ["-5vw", "88vw"], y: [0, -10, 4, 0] }
        }
        transition={{ duration: 42, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative flex items-center gap-1">
          {!prefersReducedMotion && (
            <motion.div
              className="h-1.5 rounded-full bg-gradient-to-l from-cyan-400 via-indigo-400 to-transparent blur-[2px]"
              animate={{ width: [16, 28, 16], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <svg viewBox="0 0 50 20" className="h-6 w-14 sm:h-7 sm:w-16">
            <path d="M5 10 L18 4 L38 8 L46 10 L38 12 L18 16 Z" fill="rgba(245,245,250,0.9)" stroke="#7c5cff" strokeWidth="0.8" />
            <circle cx="30" cy="10" r="2.2" fill="#5ee7e0" style={{ filter: "drop-shadow(0 0 6px #5ee7e0)" }} />
            <path d="M12 4 L8 1 L16 4 Z" fill="#b47aff" />
            <path d="M12 16 L8 19 L16 16 Z" fill="#b47aff" />
          </svg>
          {interactive && (
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan-400/40 bg-slate-900/80 px-2 py-0.5 text-[10px] text-cyan-200 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
              ✦ Capsule Voyager
            </span>
          )}
        </div>
      </motion.div>

      {/* === LAYER C: Occasional Shooting Star (Layer C) === */}
      {!prefersReducedMotion && !calm && (
        <motion.div
          className="absolute h-px w-28 bg-gradient-to-r from-transparent via-cyan-200/90 to-white/80 rounded-full pointer-events-none"
          style={{ transform: "rotate(-32deg)", filter: "blur(0.5px)" }}
          initial={{ top: "10%", left: "-8%", opacity: 0 }}
          animate={{ top: ["10%", "36%"], left: ["-6%", "62%"], opacity: [0, 1, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 10, ease: "easeOut" }}
        />
      )}

      {/* Second staggered shooting star */}
      {!prefersReducedMotion && !calm && (
        <motion.div
          className="absolute h-px w-16 bg-gradient-to-r from-transparent via-violet-300/80 to-white/60 rounded-full pointer-events-none"
          style={{ transform: "rotate(-28deg)" }}
          initial={{ top: "5%", left: "40%", opacity: 0 }}
          animate={{ top: ["5%", "25%"], left: ["40%", "88%"], opacity: [0, 0.8, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 17, delay: 5, ease: "easeOut" }}
        />
      )}

      {/* === LAYER D: Foreground star dust haze === */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(7,7,21,0.6) 100%)",
        }}
      />
    </div>
  );
}
