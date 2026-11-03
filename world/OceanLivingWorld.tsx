"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

interface OceanLivingWorldProps {
  interactive?: boolean;
  calm?: boolean;
  onSelectObject?: (objectId: string, label: string, description: string) => void;
  activeObjectId?: string | null;
}

interface Bubble { id: number; x: number; size: number; duration: number; delay: number; }
interface Fish { id: number; y: number; size: number; duration: number; delay: number; color: string; }

export function OceanLivingWorld({
  interactive = false,
  calm = false,
  onSelectObject,
  activeObjectId,
}: OceanLivingWorldProps) {
  const prefersReducedMotion = useReducedMotion();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [fishSchool, setFishSchool] = useState<Fish[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const bbs: Bubble[] = Array.from({ length: calm ? 8 : 18 }).map((_, i) => {
      const seed = i * 19.87;
      return {
        id: i,
        x: seededRandom(seed) * 94 + 3,
        size: 3 + seededRandom(seed + 1) * 8,
        duration: 9 + seededRandom(seed + 2) * 9,
        delay: seededRandom(seed + 3) * 7,
      };
    });
    setBubbles(bbs);

    const colors = ["#5ee7e0", "#38bdf8", "#818cf8", "#c084fc"];
    const fishes: Fish[] = Array.from({ length: calm ? 4 : 8 }).map((_, i) => {
      const seed = i * 53.21;
      return {
        id: i,
        y: 20 + seededRandom(seed) * 55,
        size: 14 + seededRandom(seed + 1) * 12,
        duration: 18 + seededRandom(seed + 2) * 16,
        delay: seededRandom(seed + 3) * 8,
        color: colors[i % colors.length],
      };
    });
    setFishSchool(fishes);
  }, [calm]);

  const handleObjectClick = (objectId: string, label: string, description: string) => {
    if (interactive && onSelectObject) onSelectObject(objectId, label, description);
  };

  return (
    <div
      className={`absolute inset-0 overflow-hidden select-none transition-opacity duration-1000 ${
        calm ? "opacity-35 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* === LAYER A: Deep water gradient base === */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 5%, rgba(94,231,224,0.25) 0%, transparent 55%), radial-gradient(ellipse at 20% 65%, rgba(56,189,248,0.2) 0%, transparent 50%), linear-gradient(180deg, #031218 0%, #041c2a 40%, #061e2c 70%, #020c12 100%)",
        }}
      />

      {/* Generated artwork backplate */}
      <img
        src="/worlds/abyssal-dreams.jpg"
        alt=""
        aria-hidden="true"
        onLoad={() => setImgLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1500 ${
          imgLoaded ? "opacity-52" : "opacity-0"
        }`}
        style={{ objectPosition: "center 25%" }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(2,10,18,0.72) 100%)",
        }}
      />

      {/* === LAYER B: Caustic light ripples from surface === */}
      <div className="absolute inset-x-0 top-0 h-80 overflow-hidden opacity-25 pointer-events-none" aria-hidden="true">
        <motion.div
          className="h-full w-full"
          style={{
            background:
              "repeating-linear-gradient(62deg, rgba(94,231,224,0.18) 0px, transparent 38px, rgba(56,189,248,0.12) 76px, transparent 114px)",
          }}
          animate={
            prefersReducedMotion || calm
              ? {}
              : { opacity: [0.18, 0.42, 0.18], x: [0, 22, 0], scaleX: [1, 1.04, 1] }
          }
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* === LAYER C: Swaying kelp (foreground depth) === */}
      <div className="absolute bottom-0 inset-x-0 h-44 flex items-end justify-around px-4 sm:px-10 opacity-55">
        {[0, 1, 2, 3, 4].map((idx) => (
          <motion.svg
            key={idx}
            viewBox="0 0 40 160"
            className="h-28 sm:h-40 w-8 text-teal-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            animate={
              prefersReducedMotion || calm
                ? {}
                : { rotate: [idx % 2 === 0 ? -5 : 5, idx % 2 === 0 ? 6 : -6, idx % 2 === 0 ? -5 : 5] }
            }
            transition={{ duration: 4.5 + idx * 0.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "bottom center", opacity: 0.6 + (idx % 3) * 0.1 }}
          >
            <path d="M20 160 Q10 120 25 80 Q15 40 20 10" />
            <path d="M25 80 Q35 70 30 55" strokeWidth="1.8" />
            <path d="M15 120 Q5 110 8 95" strokeWidth="1.8" />
          </motion.svg>
        ))}
      </div>

      {/* === LAYER C: Rising bubbles === */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {bubbles.map((b) => (
          <motion.div
            key={b.id}
            className="absolute rounded-full border border-cyan-300/35 bg-cyan-200/8"
            style={{ left: `${b.x}%`, bottom: "-5%", width: `${b.size}px`, height: `${b.size}px` }}
            animate={
              prefersReducedMotion || calm
                ? { y: -80, opacity: 0 }
                : {
                    y: ["0vh", "-110vh"],
                    x: [0, b.id % 2 === 0 ? 14 : -14, 0],
                    opacity: [0, 0.65, 0.4, 0],
                  }
            }
            transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      {/* === LAYER C: Distant swimming fish === */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {fishSchool.map((fish) => (
          <motion.div
            key={fish.id}
            className="absolute flex items-center"
            style={{ top: `${fish.y}%`, left: "-10vw" }}
            animate={
              prefersReducedMotion || calm
                ? {}
                : { x: ["0vw", "120vw"], y: [0, fish.id % 2 === 0 ? -14 : 14, 0] }
            }
            transition={{ duration: fish.duration, delay: fish.delay, repeat: Infinity, ease: "linear" }}
          >
            <svg
              viewBox="0 0 30 14"
              style={{ width: `${fish.size}px`, height: `${fish.size / 2}px` }}
              fill={fish.color}
              opacity="0.7"
            >
              <path d="M0 7 C8 0 20 2 26 7 C20 12 8 14 0 7 Z" />
              <polygon points="24,7 30,2 30,12" />
            </svg>
          </motion.div>
        ))}
      </div>

      {/* === LAYER C: Jellyfish (interactive focal) === */}
      <motion.div
        className={`absolute right-[14%] top-[22%] sm:right-[20%] sm:top-[20%] ${
          interactive ? "cursor-pointer group" : ""
        }`}
        onClick={() =>
          handleObjectClick(
            "jellyfish",
            "The Bioluminescent Focus Sanctuary",
            "Focus Mode creates a quiet space beneath the surface of daily distractions. Time slows down, notifications fade away, and you can give your mind completely to one task."
          )
        }
        role={interactive ? "button" : undefined}
        aria-label={interactive ? "Inspect Bioluminescent Jellyfish" : undefined}
        tabIndex={interactive ? 0 : -1}
        animate={
          prefersReducedMotion || calm
            ? {}
            : { y: [0, -20, 0], scaleY: [1, 1.07, 0.97, 1] }
        }
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative flex flex-col items-center">
          <motion.div
            className="absolute -inset-6 rounded-full blur-2xl pointer-events-none"
            animate={prefersReducedMotion ? {} : { opacity: [0.3, 0.65, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                activeObjectId === "jellyfish"
                  ? "radial-gradient(circle, rgba(94,231,224,0.6) 0%, rgba(168,85,247,0.35) 60%, transparent 80%)"
                  : "radial-gradient(circle, rgba(94,231,224,0.28) 0%, rgba(168,85,247,0.18) 60%, transparent 75%)",
            }}
          />
          <svg viewBox="0 0 70 90" className="relative z-10 h-24 w-20 sm:h-28 sm:w-24">
            <path
              d="M10 40 C10 15 60 15 60 40 C52 46 45 42 35 42 C25 42 18 46 10 40 Z"
              fill="rgba(94,231,224,0.4)"
              stroke="#5ee7e0"
              strokeWidth="1.5"
              style={{ filter: "drop-shadow(0 0 10px #5ee7e0)" }}
            />
            <circle cx="35" cy="30" r="10" fill="rgba(192,132,252,0.5)" />
            <motion.path d="M20 42 Q15 65 24 85" stroke="#5ee7e0" strokeWidth="1.2" fill="none" strokeDasharray="2 2"
              animate={prefersReducedMotion ? {} : { d: ["M20 42 Q15 65 24 85", "M20 42 Q25 65 18 85", "M20 42 Q15 65 24 85"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
            <motion.path d="M35 42 Q42 65 33 88" stroke="#c084fc" strokeWidth="1.5" fill="none"
              animate={prefersReducedMotion ? {} : { d: ["M35 42 Q42 65 33 88", "M35 42 Q28 65 37 88", "M35 42 Q42 65 33 88"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }} />
            <motion.path d="M50 42 Q55 65 46 85" stroke="#5ee7e0" strokeWidth="1.2" fill="none" strokeDasharray="2 2"
              animate={prefersReducedMotion ? {} : { d: ["M50 42 Q55 65 46 85", "M50 42 Q45 65 52 85", "M50 42 Q55 65 46 85"] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }} />
          </svg>
          {interactive && (
            <span className="mt-1 whitespace-nowrap rounded-full border border-cyan-400/40 bg-slate-900/80 px-2 py-0.5 text-[10px] text-cyan-200 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
              ✦ Focus Jellyfish
            </span>
          )}
        </div>
      </motion.div>

      {/* === LAYER C: Reflective Pearl Shell (Journal) === */}
      <div
        className={`absolute bottom-[16%] left-[16%] sm:left-[22%] ${
          interactive ? "cursor-pointer group" : ""
        }`}
        onClick={() =>
          handleObjectClick(
            "ocean-pearl",
            "The Reflective Journal Shell",
            "Your thoughts, feelings, and evening reflections rest safely here. Writing things down brings calm clarity, helping you reset before tomorrow."
          )
        }
        role={interactive ? "button" : undefined}
        aria-label={interactive ? "Inspect Reflective Shell" : undefined}
        tabIndex={interactive ? 0 : -1}
      >
        <div className="relative flex flex-col items-center">
          <div
            className="absolute -inset-3 rounded-full blur-lg transition-opacity duration-500"
            style={{
              background:
                activeObjectId === "ocean-pearl"
                  ? "radial-gradient(circle, rgba(244,114,182,0.5) 0%, rgba(94,231,224,0.3) 60%, transparent 80%)"
                  : "radial-gradient(circle, rgba(94,231,224,0.22) 0%, transparent 65%)",
            }}
          />
          <svg viewBox="0 0 50 40" className="relative z-10 h-16 w-20">
            <path d="M10 32 C10 16 40 16 40 32 Q25 36 10 32 Z" fill="rgba(30,41,59,0.9)" stroke="#38bdf8" strokeWidth="1.5" />
            <circle cx="25" cy="24" r="6" fill="#ffffff" style={{ filter: "drop-shadow(0 0 10px #5ee7e0)" }} />
            <circle cx="23" cy="22" r="1.8" fill="#5ee7e0" opacity="0.6" />
          </svg>
          {interactive && (
            <span className="mt-1 whitespace-nowrap rounded-full border border-sky-400/40 bg-slate-900/80 px-2 py-0.5 text-[10px] text-sky-200 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
              ✦ Reflective Pearl
            </span>
          )}
        </div>
      </div>

      {/* === LAYER D: Bottom depth gradient === */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent 0%, rgba(2,10,18,0.8) 100%)" }}
      />
    </div>
  );
}
