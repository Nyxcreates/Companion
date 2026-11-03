/**
 * The single place a goal's completion percentage is ever computed —
 * always safe, never divides by a zero/missing target. A qualitative
 * goal (no targetValue) simply returns null, meaning "no percentage
 * applies," per the explicit "handle target = 0 safely, don't force
 * fake percentages" requirement.
 */
export function computeProgressPercent(targetValue: number | null, progressValue: number | null): number | null {
  if (!targetValue || targetValue <= 0) return null;
  const value = progressValue ?? 0;
  const percent = (value / targetValue) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}