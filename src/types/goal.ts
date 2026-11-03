import { GOAL_OPTIONS } from "@/lib/onboarding/options";

/** Reuses the exact same category ids the onboarding wizard already collects — a goal's category always means the same thing everywhere in the app, with zero duplication. */
export type GoalCategory = (typeof GOAL_OPTIONS)[number]["id"];

export type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type GoalPriority = "LOW" | "MEDIUM" | "HIGH";

export interface GoalSummary {
  id: string;
  title: string;
  description: string | null;
  category: GoalCategory | null;
  priority: GoalPriority;
  status: GoalStatus;
  deadline: string | null;
  targetLabel: string | null;
  targetValue: number | null;
  progressValue: number | null;
  /** Derived, 0-100, or null for a qualitative goal with no measurable target. Always the authoritative computed value — see lib/goals/progress.ts. */
  progressPercent: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}