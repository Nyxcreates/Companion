import mongoose, { Schema, type Document, type Model } from "mongoose";
import { GOAL_STATUSES, GOAL_PRIORITIES } from "@/lib/goals/constants";
import type { GoalCategory, GoalPriority, GoalStatus } from "@/types/goal";

/**
 * A Goal: something meaningful the user is working toward — distinct
 * from a Task (a concrete action), which has no system yet in this
 * codebase. See 07_FEATURES.md.
 *
 * Progress is optional and honest: targetValue/progressValue only
 * apply to measurable goals ("100 focus sessions"); a purely
 * qualitative goal ("Become consistent at coding") has no target and
 * no progress bar — see lib/goals/progress.ts, the single place a
 * percentage is ever computed, always safely.
 *
 * Milestones are a documented future extension (a subdocument array),
 * not implemented in this schema yet — adding one later is additive,
 * matching how Capsule.ts documents its own future unlockType
 * extension without building it prematurely.
 */
export interface GoalDocument extends Document {
  firebaseUid: string;
  title: string;
  description: string | null;
  category: GoalCategory | null;
  priority: GoalPriority;
  status: GoalStatus;
  deadline: Date | null;
  targetLabel: string | null;
  targetValue: number | null;
  progressValue: number | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

const GoalSchema = new Schema<GoalDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    category: { type: String, default: null },
    priority: { type: String, enum: GOAL_PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: GOAL_STATUSES, default: "ACTIVE" },
    deadline: { type: Date, default: null },
    targetLabel: { type: String, default: null },
    targetValue: { type: Number, default: null },
    progressValue: { type: Number, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Two hot lookups: "this user's goals, newest first" (the goals page)
// and "this user's active goals" (both the goals page's Active
// section and the AI context builder).
GoalSchema.index({ firebaseUid: 1, createdAt: -1 });
GoalSchema.index({ firebaseUid: 1, status: 1 });

export const GoalModel: Model<GoalDocument> =
  mongoose.models.Goal || mongoose.model<GoalDocument>("Goal", GoalSchema);