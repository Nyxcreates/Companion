"use client";

import { memo } from "react";
import { seededRandom } from "@/lib/pseudoRandom";

/**
 * The static backdrop of the garden: a quiet night sky, low hills and
 * soil, with a little grass, a few stones and a handful of fireflies.
 * Everything is positioned by percentage and generated from seeded
 * values, so it's identical on every render (no hydration mismatch)
 * and costs nothing to keep on screen. It follows the palette of the
 * story-mode Garden environment — deep green ground, emerald glow.
 */

function Tuft({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <svg
      viewBox="0 0 14 10"
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%`, width: 14 * scale, height: 10 * scale }}
      aria-hidden="true"
    >
      <path d="M2 10 Q3 5 1 1 M7 10 Q7 4 8 0 M12 10 Q11 5 13 2" stroke="#2c7a5c" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export const GardenLandscape = memo(function GardenLandscape({ columns }: { columns: number }) {
  const tufts = Array.from({ length: columns * 4 }, (_, i) => ({
    x: 2 + seededRandom(i * 7 + 1) * 94,
    y: 46 + seededRandom(i * 7 + 2) * 50,
    scale: 0.8 + seededRandom(i * 7 + 3) * 0.7,
  }));

  const stones = Array.from({ length: Math.max(2, Math.round(columns / 2)) }, (_, i) => ({
    x: 4 + seededRandom(i * 11 + 5) * 90,
    y: 50 + seededRandom(i * 11 + 6) * 44,
    w: 9 + seededRandom(i * 11 + 7) * 9,
  }));

  const stars = Array.from({ length: 12 }, (_, i) => ({
    x: seededRandom(i * 5 + 1) * 96 + 2,
    y: seededRandom(i * 5 + 2) * 26 + 2,
    opacity: 0.25 + seededRandom(i * 5 + 3) * 0.3,
    duration: 4 + seededRandom(i * 5 + 4) * 5,
  }));

  const fireflyCount = Math.min(18, 6 + columns);
  const fireflies = Array.from({ length: fireflyCount }, (_, i) => ({
    x: seededRandom(i * 13 + 1) * 96 + 2,
    y: 34 + seededRandom(i * 13 + 2) * 58,
    duration: 6 + seededRandom(i * 13 + 3) * 5,
    delay: seededRandom(i * 13 + 4) * 6,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <style>{`
        @keyframes garden-sway { 0%, 100% { transform: rotate(-1.6deg); } 50% { transform: rotate(1.6deg); } }
        @keyframes garden-glow { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        .garden-sway { animation: garden-sway var(--sway-duration, 6s) ease-in-out infinite; animation-delay: var(--sway-delay, 0s); }
        .garden-glow { animation: garden-glow 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .garden-sway, .garden-glow { animation: none; } }
      `}</style>

      {/* sky */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, #0d0c26 0%, #111a38 24%, #12303a 42%, #0f2a22 42.1%, #0b1f19 75%, #0a1a15 100%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 22% 30%, rgba(52,211,153,0.10), transparent 50%), radial-gradient(circle at 80% 70%, rgba(244,114,182,0.06), transparent 45%)" }}
      />

      {stars.map((star, i) => (
        <span
          key={i}
          className="animate-star-twinkle absolute h-[2px] w-[2px] rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            ["--star-opacity" as string]: star.opacity,
            animationDuration: `${star.duration}s`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}

      {/* a quiet moon */}
      <div
        className="absolute h-9 w-9 rounded-full"
        style={{
          right: "10%",
          top: "8%",
          background: "radial-gradient(circle at 35% 35%, #f5f5fa, #cfd0e6)",
          opacity: 0.5,
          boxShadow: "0 0 32px rgba(245,245,250,0.18)",
        }}
      />

      {/* low hills along the horizon */}
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute left-0 w-full" style={{ top: "31%", height: "11.5%" }}>
        <path d="M0 12 C15 2 30 8 45 5 C60 2 75 9 100 4 L100 20 L0 20Z" fill="#0d2a2a" />
        <path d="M0 16 C20 9 35 14 55 11 C75 8 90 13 100 10 L100 20 L0 20Z" fill="#0f2a22" />
      </svg>

      {stones.map((stone, i) => (
        <span
          key={i}
          className="absolute rounded-[50%]"
          style={{
            left: `${stone.x}%`,
            top: `${stone.y}%`,
            width: stone.w,
            height: stone.w * 0.55,
            background: "linear-gradient(180deg, #2f453b, #22352d)",
            opacity: 0.8,
          }}
        />
      ))}

      {tufts.map((tuft, i) => (
        <Tuft key={i} x={tuft.x} y={tuft.y} scale={tuft.scale} />
      ))}

      {fireflies.map((fly, i) => (
        <span
          key={i}
          className="animate-firefly absolute h-1 w-1 rounded-full bg-accent-emerald/70"
          style={{ left: `${fly.x}%`, top: `${fly.y}%`, animationDuration: `${fly.duration}s`, animationDelay: `${fly.delay}s` }}
        />
      ))}
    </div>
  );
});