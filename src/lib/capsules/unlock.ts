import type { CapsuleStatus, RelativeDurationOption } from "@/types/capsule";

/** The single place capsule status is computed — SEALED/UNLOCKED/OPENED is always derived, never stored, so it can never drift out of sync with the real clock. */
export function computeCapsuleStatus(unlockAt: Date, openedAt: Date | null, now: Date = new Date()): CapsuleStatus {
  if (openedAt) return "OPENED";
  if (unlockAt.getTime() <= now.getTime()) return "UNLOCKED";
  return "SEALED";
}

export const RELATIVE_DURATION_OPTIONS: { value: RelativeDurationOption; label: string }[] = [
  { value: "1_week", label: "1 week" },
  { value: "1_month", label: "1 month" },
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "1_year", label: "1 year" },
];

/**
 * Resolves a relative duration option to an actual Date, computed
 * once at creation time and stored as `unlockAt`. Never recalculated
 * from the label later, so a capsule's unlock moment is stable
 * regardless of when it's viewed.
 */
export function resolveRelativeUnlockDate(option: RelativeDurationOption, from: Date = new Date()): Date {
  const date = new Date(from);
  switch (option) {
    case "1_week":
      date.setDate(date.getDate() + 7);
      break;
    case "1_month":
      date.setMonth(date.getMonth() + 1);
      break;
    case "3_months":
      date.setMonth(date.getMonth() + 3);
      break;
    case "6_months":
      date.setMonth(date.getMonth() + 6);
      break;
    case "1_year":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return date;
}