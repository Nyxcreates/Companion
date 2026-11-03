"use client";

import { memo, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ease } from "@/lib/motion";
import type { CapsuleStatus, CapsuleSummary } from "@/types/capsule";
import type { GardenPlantModel, GardenRow, GardenStage, GardenTone } from "@/types/garden";

const TONE_COLORS: Record<GardenTone, { petal: string; center: string }> = {
  rose: { petal: "#f472b6", center: "#fde8a8" },
  gold: { petal: "#fbbf24", center: "#fb923c" },
  cyan: { petal: "#5ee7e0", center: "#fde8a8" },
  lilac: { petal: "#a78bfa", center: "#fde8a8" },
};

const LEAF_LIGHT = "#34d399";
const LEAF_DARK = "#22a374";
const STEM = "#2fbf8a";

/** Rendered width (px) per depth row — back plants read as further away. Height follows the 4:5 viewBox. */
const ROW_WIDTH: Record<GardenRow, number> = { 0: 56, 1: 66, 2: 76 };
const ROW_Z: Record<GardenRow, string> = { 0: "z-[1]", 1: "z-[2]", 2: "z-[3]" };

const STATUS_WORDS: Record<CapsuleStatus, string> = {
  SEALED: "sealed, still growing",
  UNLOCKED: "ready to open",
  OPENED: "opened",
};

function Mound() {
  return (
    <>
      <ellipse cx="40" cy="93" rx="21" ry="4.5" fill="#0a1a15" opacity="0.55" />
      <path d="M21 93 Q40 81 59 93 Z" fill="#1d3b31" />
      <path d="M27 91 Q40 84 53 91" stroke="#2b5545" strokeWidth="1" fill="none" opacity="0.6" strokeLinecap="round" />
    </>
  );
}

function Leaf({ x, y, dir, dark, size = 1 }: { x: number; y: number; dir: 1 | -1; dark?: boolean; size?: number }) {
  const w = 14 * size * dir;
  const h = 11 * size;
  return (
    <path
      d={`M${x} ${y} Q${x + w} ${y - 1} ${x + w * 1.15} ${y - h} Q${x + w * 0.1} ${y - h} ${x} ${y}Z`}
      fill={dark ? LEAF_DARK : LEAF_LIGHT}
      opacity="0.92"
    />
  );
}

interface PlantGlyphProps {
  stage: GardenStage;
  tone: GardenTone;
  /** Adds the slow idle sway. Off for panels and for very large gardens. */
  ambient?: boolean;
  swayDuration?: number;
  swayDelay?: number;
  className?: string;
}

/**
 * One capsule's plant as a small inline SVG. Purely presentational —
 * the stage and tone are derived elsewhere (lib/garden/derive.ts).
 * Idle motion is CSS-only (transform/opacity), so a garden full of
 * plants costs no JavaScript per frame.
 */
export function PlantGlyph({ stage, tone, ambient = false, swayDuration = 6, swayDelay = 0, className }: PlantGlyphProps) {
  const { petal, center } = TONE_COLORS[tone];
  const swayStyle = ambient
    ? ({
        transformOrigin: "40px 92px",
        transformBox: "view-box",
        ["--sway-duration" as string]: `${swayDuration}s`,
        ["--sway-delay" as string]: `${swayDelay}s`,
      } as CSSProperties)
    : undefined;
  const swayClass = ambient ? "garden-sway" : undefined;

  return (
    <svg viewBox="0 0 80 100" className={className} aria-hidden="true" focusable="false">
      <Mound />

      {stage === "seed" && (
        <g>
          <ellipse cx="40" cy="88.5" rx="4" ry="5.5" fill="#d6b98a" transform="rotate(-18 40 88.5)" />
          <path d="M38.6 85.6 Q39.4 84.4 40.6 84.2" stroke="#f0dcb4" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
          <circle cx="33" cy="91.2" r="1" fill="#2b5545" />
          <circle cx="48" cy="90.6" r="0.9" fill="#2b5545" />
        </g>
      )}

      {stage === "sprout" && (
        <g className={swayClass} style={swayStyle}>
          <path d="M40 90 C40 84 41 79 40 73" stroke={STEM} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <Leaf x={40} y={80} dir={-1} />
          <Leaf x={40} y={77} dir={1} dark />
        </g>
      )}

      {stage === "bud" && (
        <g className={swayClass} style={swayStyle}>
          <path d="M40 90 C40 78 41 67 40 57" stroke={STEM} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <Leaf x={40} y={79} dir={-1} size={1.1} />
          <Leaf x={40} y={69} dir={1} dark size={1.05} />
          <path d="M40 41 C33 47 34 56 40 58 C46 56 47 47 40 41Z" fill={petal} opacity="0.78" />
          <path d="M34 56 Q40 52 46 56 Q40 60 34 56Z" fill={LEAF_DARK} />
        </g>
      )}

      {stage === "ready" && (
        <g className={swayClass} style={swayStyle}>
          <circle cx="40" cy="38" r="26" fill="var(--accent-secondary)" opacity="0.08" className="garden-glow" />
          <circle cx="40" cy="38" r="16" fill="var(--accent-secondary)" opacity="0.16" className="garden-glow" />
          <path d="M40 90 C40 76 41 60 40 47" stroke={STEM} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <Leaf x={40} y={80} dir={-1} size={1.15} />
          <Leaf x={40} y={70} dir={1} dark size={1.1} />
          <Leaf x={40} y={62} dir={-1} dark size={0.9} />
          <ellipse cx="40" cy="35" rx="5.5" ry="11" transform="rotate(-26 40 47)" fill={petal} opacity="0.9" />
          <ellipse cx="40" cy="35" rx="5.5" ry="11" transform="rotate(26 40 47)" fill={petal} opacity="0.9" />
          <ellipse cx="40" cy="34" rx="5.5" ry="11.5" fill={petal} />
          <path d="M37.5 28 Q39 24 41 23" stroke="#ffffff" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.5" />
        </g>
      )}

      {stage === "bloom" && (
        <g className={swayClass} style={swayStyle}>
          <circle cx="40" cy="38" r="28" fill={petal} opacity="0.09" />
          <circle cx="40" cy="38" r="18" fill={petal} opacity="0.13" />
          <path d="M40 90 C40 74 41 58 40 46" stroke={STEM} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Leaf x={40} y={80} dir={-1} size={1.2} />
          <Leaf x={40} y={72} dir={1} dark size={1.15} />
          <Leaf x={40} y={62} dir={-1} dark size={1} />
          <Leaf x={40} y={56} dir={1} size={0.85} />
          <g transform="translate(40 38)">
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <ellipse key={angle} cx="0" cy="-9" rx="5.6" ry="10" transform={`rotate(${angle})`} fill={petal} opacity="0.92" />
            ))}
            <circle r="4.6" fill={center} />
          </g>
        </g>
      )}
    </svg>
  );
}

interface GardenPlantProps {
  plant: GardenPlantModel;
  capsule: CapsuleSummary;
  index: number;
  ambient: boolean;
  onSelect: (capsule: CapsuleSummary) => void;
}

/**
 * A single tappable plant in the scene. The outer div only positions;
 * the entry/bloom animation lives on an inner element keyed by stage,
 * so a capsule changing state (e.g. being opened) re-plays a soft
 * grow-in instead of snapping.
 */
export const GardenPlant = memo(function GardenPlant({ plant, capsule, index, ambient, onSelect }: GardenPlantProps) {
  const reduceMotion = useReducedMotion();
  const width = ROW_WIDTH[plant.row];
  const height = Math.round(width * 1.25);
  const name = capsule.title ?? "Untitled capsule";

  return (
    <div
      className={`group absolute hover:z-20 focus-within:z-20 ${ROW_Z[plant.row]}`}
      style={{ left: `${plant.x}%`, top: `${plant.y}%`, width, height, transform: "translate(-50%, -100%)" }}
    >
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 max-w-[10rem] -translate-x-1/2 truncate whitespace-nowrap rounded-lg border border-white/10 bg-surface-elevated/90 px-2.5 py-1 text-xs text-ink-primary opacity-0 shadow-card transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        {name}
      </span>

      <button
        type="button"
        onClick={() => onSelect(capsule)}
        aria-label={`${name}, ${STATUS_WORDS[capsule.status]}`}
        className="block h-full w-full origin-bottom rounded-xl transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/60"
      >
        <motion.div
          key={plant.stage}
          className="h-full w-full origin-bottom"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: ease.gentle, delay: reduceMotion ? 0 : Math.min(index * 0.05, 0.6) }}
        >
          <PlantGlyph
            stage={plant.stage}
            tone={plant.tone}
            ambient={ambient}
            swayDuration={plant.swayDuration}
            swayDelay={plant.swayDelay}
            className="h-full w-full"
          />
        </motion.div>
      </button>
    </div>
  );
});