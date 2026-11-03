import type { TaskStatus } from "@/types/task";

/** Purely informational — never flags a passed due date as "overdue" or alarming, matching the product's no-shame principle (same reasoning as formatDeadlineLabel for goals). */
export function formatDueDateLabel(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return `Due ${date.toLocaleDateString(
    undefined,
    sameYear ? { month: "long", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" }
  )}`;
}

export function formatTaskStatusLabel(status: TaskStatus): string {
  if (status === "IN_PROGRESS") return "In progress";
  return status.charAt(0) + status.slice(1).toLowerCase();
}