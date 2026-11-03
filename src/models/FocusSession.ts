import mongoose, { Schema, type Document, type Model } from "mongoose";

export type FocusSessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

/**
 * A recorded period of intentional focused work on a Task. Distinct
 * from a Task itself — a Task can have many sessions, and finishing
 * one never implies the Task is done (see the Focus Mode milestone
 * spec, section 3).
 *
 * No goalId here on purpose: a session's Goal (if any) is always
 * reached through taskId → Task.goalId, per the spec's explicit
 * instruction not to duplicate that relationship.
 *
 * Timer reliability: this schema stores only real timestamps
 * (startedAt, pausedAt, accumulatedPausedMs) — never a
 * "secondsRemaining" counter — so elapsed/remaining time is always
 * recomputed from timestamps (see lib/focus/timer.ts), immune to
 * browser throttling, tab switching, or refresh.
 */
export interface FocusSessionDocument extends Document {
  firebaseUid: string;
  taskId: mongoose.Types.ObjectId;
  status: FocusSessionStatus;
  plannedDurationSeconds: number;
  startedAt: Date;
  /** Set while paused; null otherwise. */
  pausedAt: Date | null;
  /** Sum of all previously-completed pause intervals, in ms. */
  accumulatedPausedMs: number;
  completedAt: Date | null;
  cancelledAt: Date | null;
  /** Finalized only on complete/cancel — the real, server-computed focused time. */
  actualDurationSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const FocusSessionSchema = new Schema<FocusSessionDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    status: { type: String, enum: ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"], default: "ACTIVE" },
    plannedDurationSeconds: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    pausedAt: { type: Date, default: null },
    accumulatedPausedMs: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    actualDurationSeconds: { type: Number, default: null },
  },
  { timestamps: true }
);

// Three hot lookups: "does this user have an active/paused session
// right now" (recovery + the one-active-session-at-a-time rule),
// "this user's sessions, newest first" (history), and "this task's
// sessions" (a future task-detail history view).
FocusSessionSchema.index({ firebaseUid: 1, status: 1 });
FocusSessionSchema.index({ firebaseUid: 1, createdAt: -1 });
FocusSessionSchema.index({ firebaseUid: 1, taskId: 1 });

export const FocusSessionModel: Model<FocusSessionDocument> =
  mongoose.models.FocusSession || mongoose.model<FocusSessionDocument>("FocusSession", FocusSessionSchema);