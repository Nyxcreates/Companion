/**
 * Deterministic pseudo-random generator.
 *
 * Procedurally generated scenery (star positions, dust drift, comet
 * timing) needs to render identically on the server and the client —
 * Math.random() would differ between the two and cause hydration
 * mismatches. Seed with any number to get a stable value in [0, 1).
 */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}