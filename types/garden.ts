/**
 * Garden-only types. Nothing here is persisted — a Garden plant is a
 * pure, derived view of an existing Memory Capsule (see
 * lib/garden/derive.ts). There is intentionally no GardenItem model.
 */

/** How a capsule looks in the garden. Derived from capsule status + time, never stored. */
export type GardenStage = "seed" | "sprout" | "bud" | "ready" | "bloom";

export type GardenTone = "rose" | "gold" | "cyan" | "lilac";

/** Depth row: 0 = back (small, high), 2 = front (larger, low). */
export type GardenRow = 0 | 1 | 2;

export interface GardenPlantModel {
  id: string;
  stage: GardenStage;
  tone: GardenTone;
  row: GardenRow;
  /** Horizontal position inside the scene, 0–100 (%). */
  x: number;
  /** Baseline (ground contact) position inside the scene, 0–100 (%). */
  y: number;
  /** Stable per-plant values for ambient sway so plants never move in sync. */
  swayDuration: number;
  swayDelay: number;
}

export interface GardenLayout {
  plants: GardenPlantModel[];
  /** Number of columns in the current layout tier — drives the scene's minimum width. */
  columns: number;
}