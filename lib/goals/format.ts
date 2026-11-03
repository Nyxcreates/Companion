import { GOAL_OPTIONS } from "@/lib/onboarding/options";
import type { GoalCategory, GoalPriority } from "@/types/goal";

export function formatCategoryLabel(category: GoalCategory | null): string | null {
  if (!category) return null;
  return GOAL_OPTIONS.find((o) => o.id === category)?.label ?? null;
}

/**
 * Purely informational — never flags a past deadline as "overdue" or
 * anything alarming. A deadline is information, not a verdict, per
 * the product's no-shame principle.
 */
export function formatDeadlineLabel(deadline: string | null): string | null {
  if (!deadline) return null;
  const date = new Date(deadline);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `Due ${date.toLocaleDateString(
    undefined,
    sameYear ? { month: "long", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" }
  )}`;
}

export function formatPriorityLabel(priority: GoalPriority): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}