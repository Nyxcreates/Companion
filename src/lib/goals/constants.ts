import type { GoalPriority, GoalStatus } from "@/types/goal";

export const GOAL_STATUSES: GoalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];
export const GOAL_PRIORITIES: GoalPriority[] = ["LOW", "MEDIUM", "HIGH"];

export const GOAL_PRIORITY_OPTIONS: { value: GoalPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];