import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { ScheduleItemType } from "@/types/schedule";

/**
 * One user's structured, time-divided plan for a single calendar
 * date. One document per (firebaseUid, date): asking Nikki to
 * "make tomorrow's timetable" again replaces that day's schedule
 * rather than accumulating duplicates. Items are embedded, not a
 * separate collection — they only ever make sense as part of one
 * day's plan and are never queried independently.
 */
export interface ScheduleItemSubdoc {
  start: string;
  end: string;
  title: string;
  type: ScheduleItemType;
  taskId: mongoose.Types.ObjectId | null;
}

export interface ScheduleDocument extends Document {
  firebaseUid: string;
  date: string;
  items: ScheduleItemSubdoc[];
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleItemSchema = new Schema<ScheduleItemSubdoc>(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
    title: { type: String, required: true },
    type: { type: String, enum: ["task", "break", "commitment", "free"], required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
  },
  { _id: false }
);

const ScheduleSchema = new Schema<ScheduleDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    date: { type: String, required: true },
    items: { type: [ScheduleItemSchema], default: [] },
  },
  { timestamps: true }
);

ScheduleSchema.index({ firebaseUid: 1, date: 1 }, { unique: true });

export const ScheduleModel: Model<ScheduleDocument> =
  mongoose.models.Schedule || mongoose.model<ScheduleDocument>("Schedule", ScheduleSchema);