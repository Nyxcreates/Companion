import mongoose, { Schema, type Document, type Model } from "mongoose";
import { TASK_STATUSES } from "@/lib/tasks/constants";
import type { TaskStatus } from "@/types/task";

/**
 * A Task: a concrete action, distinct from a Goal (an aspiration —
 * see Goal.ts's own doc comment, which already documented this exact
 * distinction before a Task system existed). A task may optionally
 * belong to a Goal via goalId; it is never required to.
 *
 * Kept deliberately small — title, description, status, dueDate,
 * goalId, ownership, timestamps. No priority/category/target fields;
 * those are Goal concepts, not Task concepts, per the task-system
 * milestone spec ("do not automatically add dozens of fields").
 *
 * `taskId` on a future FocusSession is the documented next extension
 * point (see the Focus Mode milestone spec) — not built here.
 */
export interface TaskDocument extends Document {
  firebaseUid: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: Date | null;
  goalId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

const TaskSchema = new Schema<TaskDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    status: { type: String, enum: TASK_STATUSES, default: "PENDING" },
    dueDate: { type: Date, default: null },
    goalId: { type: Schema.Types.ObjectId, ref: "Goal", default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Two hot lookups: "this user's tasks, newest first" (the tasks page)
// and "this user's tasks for one goal" (a future goal detail view).
TaskSchema.index({ firebaseUid: 1, createdAt: -1 });
TaskSchema.index({ firebaseUid: 1, goalId: 1 });

export const TaskModel: Model<TaskDocument> =
  mongoose.models.Task || mongoose.model<TaskDocument>("Task", TaskSchema);