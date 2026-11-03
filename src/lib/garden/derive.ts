import type { CapsuleSummary } from "@/types/capsule";
import type { GardenLayout, GardenPlantModel, GardenRow, GardenStage, GardenTone } from "@/types/garden";

/**
 * Pure derivation of Garden visuals from existing Memory Capsules.
 *
 * Nothing in this file touches the network or the database, and
 * nothing it returns is stored: the Garden is recomputed from the
 * capsule list every time, so a capsule that is deleted or changes
 * status is reflected automatically and there can be no orphaned
 * Garden objects.
 */

const TONES: GardenTone[] = ["rose", "gold", "cyan", "lilac"];

/** Depth rows: baseline position (% of scene height) for back / middle / front. */
const ROW_Y: Record<GardenRow, number> = { 0: 52, 1: 68, 2: 84 };

const MIN_SLOTS = 12; // 4 columns × 3 rows
const SLOTS_PER_COLUMN = 3;

/** FNV-1a — a small, stable string hash so positions/tones are identical on every render, device and session. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A stable value in [0, 1) derived from a string and a salt. */
function unit(input: string, salt: number): number {
  return (hashString(`${salt}:${input}`) % 10000) / 10000;
}

/**
 * Stage mapping (all derived from existing capsule data):
 *  - SEALED   → seed → sprout → bud, growing with how much of the
 *               wait between writing and unlocking has passed
 *  - UNLOCKED → "ready": a glowing bud waiting to open
 *  - OPENED   → "bloom": fully grown
 *
 * `now` is only used to pace the cosmetic growth of a SEALED capsule.
 * Whether a capsule is sealed/unlocked/opened always comes from the
 * server-computed `status`, never from this client clock.
 */
export function deriveStage(capsule: CapsuleSummary, now: number = Date.now()): GardenStage {
  if (capsule.status === "OPENED") return "bloom";
  if (capsule.status === "UNLOCKED") return "ready";

  const start = new Date(capsule.createdAt).getTime();
  const end = new Date(capsule.unlockAt).getTime();
  const span = end - start;
  if (!Number.isFinite(span) || span <= 0) return "bud";

  const progress = Math.min(1, Math.max(0, (now - start) / span));
  if (progress < 0.34) return "seed";
  if (progress < 0.75) return "sprout";
  return "bud";
}

export function deriveTone(id: string): GardenTone {
  return TONES[hashString(id) % TONES.length];
}

/** Smallest layout tier (12, 24, 48, …) that leaves comfortable room for `count` plants. */
export function slotCountFor(count: number): number {
  let slots = MIN_SLOTS;
  while (slots < count * 1.5) slots *= 2;
  return slots;
}

/**
 * Assigns each capsule a unique slot. Capsules are processed oldest
 * first and start from a slot preferred by their id hash, probing
 * forward if it's taken. This means a newly created capsule (always
 * the newest) never moves existing plants, and positions are the same
 * on every visit. The only time plants rearrange is when the garden
 * grows into a larger layout tier.
 */
export function assignSlots(capsules: CapsuleSummary[]): Map<string, number> {
  const total = slotCountFor(capsules.length);
  const taken = new Array<boolean>(total).fill(false);
  const slots = new Map<string, number>();

  const ordered = [...capsules].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  for (const capsule of ordered) {
    let slot = hashString(capsule.id) % total;
    while (taken[slot]) slot = (slot + 1) % total;
    taken[slot] = true;
    slots.set(capsule.id, slot);
  }

  return slots;
}

export function deriveLayout(capsules: CapsuleSummary[], now: number = Date.now()): GardenLayout {
  const total = slotCountFor(capsules.length);
  const columns = total / SLOTS_PER_COLUMN;
  const slots = assignSlots(capsules);

  const plants: GardenPlantModel[] = capsules.map((capsule) => {
    const slot = slots.get(capsule.id) ?? 0;
    const row = (slot % SLOTS_PER_COLUMN) as GardenRow;
    const column = Math.floor(slot / SLOTS_PER_COLUMN);

    // Middle row is offset by half a cell so plants in neighbouring rows don't stack directly.
    const columnOffset = row === 1 ? 0.5 : 0;
    const jitterX = (unit(capsule.id, 1) - 0.5) * 0.36; // ±0.18 of a cell
    const jitterY = (unit(capsule.id, 2) - 0.5) * 4; // ±2% of scene height

    const rawX = ((column + 0.5 + columnOffset + jitterX) / (columns + 0.5)) * 100;
    const x = Math.min(95, Math.max(5, rawX));

    return {
      id: capsule.id,
      stage: deriveStage(capsule, now),
      tone: deriveTone(capsule.id),
      row,
      x,
      y: ROW_Y[row] + jitterY,
      swayDuration: 5 + unit(capsule.id, 3) * 3,
      swayDelay: -unit(capsule.id, 4) * 6,
    };
  });

  return { plants, columns };
}