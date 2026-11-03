"use client";

import { motion, useReducedMotion } from "framer-motion";

interface Scene03Props {
  currentBlockIndex: number;
}

export function Scene03ArrivalOfCompanion({ currentBlockIndex }: Scene03Props) {
  const prefersReducedMotion = useReducedMotion();

  // Nodes for constellation graph
  const constellationNodes = [
    { x: 50, y: 35, r: 4, label: "You" },
    { x: 30, y: 55, r: 3, label: "Mind" },
    { x: 70, y: 50, r: 3.5, label: "Days" },
    { x: 42, y: 75, r: 3, label: "Peace" },
    { x: 62, y: 78, r: 3, label: "Growth" },
    { x: 20, y: 30, r: 2.5, label: "Heart" },
    { x: 82, y: 32, r: 2.5, label: "Dreams" },
  ];

  const constellationEdges = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 4],
    [0, 5],
    [0, 6],
    [1, 5],
    [2, 6],
  ];

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Constellation Canvas & Glow */}
      <div className="relative mb-6 flex h-48 w-full max-w-md items-center justify-center sm:h-56">
        <motion.div
          className="absolute inset-0 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(94, 231, 224, 0.22) 0%, rgba(124, 92, 255, 0.15) 50%, transparent 75%)" }}
          animate={prefersReducedMotion ? {} : { scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <svg viewBox="0 0 100 100" className="relative z-10 h-full w-full" fill="none">
          {/* Constellation connecting lines */}
          {constellationEdges.map(([startIdx, endIdx], i) => {
            const start = constellationNodes[startIdx];
            const end = constellationNodes[endIdx];
            return (
              <motion.line
                key={`edge-${i}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="url(#constellationLine)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.7 }}
                transition={{ duration: 1.8, delay: 0.2 + i * 0.12, ease: "easeOut" }}
              />
            );
          })}

          {/* Golden energy pulse running across lines */}
          {!prefersReducedMotion && (
            <motion.circle
              r="1.8"
              fill="#ffd166"
              className="drop-shadow-[0_0_6px_#ffd166]"
              animate={{
                cx: [50, 30, 42, 62, 70, 50],
                cy: [35, 55, 75, 78, 50, 35],
                opacity: [0, 0.9, 1, 0.9, 0],
              }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {/* Constellation stars/nodes */}
          {constellationNodes.map((node, i) => (
            <g key={`node-${i}`}>
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={node.r * 2.2}
                fill="rgba(124, 92, 255, 0.25)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.08 }}
              />
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={node.r}
                fill="#ffffff"
                className="drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.08 }}
              />
            </g>
          ))}

          <defs>
            <linearGradient id="constellationLine" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5ee7e0" stopOpacity="0.8" />
              <stop offset="0.5" stopColor="#b47aff" stopOpacity="0.6" />
              <stop offset="1" stopColor="#ffd166" stopOpacity="0.7" />
            </linearGradient>
          </defs>
        </svg>

        {/* Pulsing center welcome emblem */}
        <motion.div
          className="pointer-events-none absolute bottom-1 flex items-center gap-2 rounded-full border border-violet-500/30 bg-slate-900/80 px-3.5 py-1 backdrop-blur-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          <span className="font-mono text-[11px] font-medium tracking-widest uppercase text-violet-200">
            A New Constellation Forms
          </span>
        </motion.div>
      </div>

      {/* Narrative Text */}
      <div className="flex flex-col items-center gap-4 text-center">
        <motion.p
          className="font-display text-2xl font-light tracking-wide text-ink-primary sm:text-3xl md:text-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.2 }}
        >
          &ldquo;You don&apos;t have to figure it all out alone.&rdquo;
        </motion.p>

        <motion.p
          className="max-w-xl text-base text-ink-secondary sm:text-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          Companion is a personal space built around your life. Not to judge. Not to overwhelm. Just to walk with you, day by day.
        </motion.p>

        {currentBlockIndex >= 1 && (
          <motion.div
            className="mt-3 flex flex-wrap items-center justify-center gap-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-xs font-medium text-cyan-300">
              ✦ Judgment-free
            </div>
            <div className="rounded-full border border-violet-500/30 bg-violet-950/40 px-3 py-1 text-xs font-medium text-violet-300">
              ✦ Adaptive pace
            </div>
            <div className="rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-300">
              ✦ Always in your corner
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
