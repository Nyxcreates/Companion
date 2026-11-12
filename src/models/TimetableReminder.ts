import mongoose, { Schema, type Document, type Model } from "mongoose";

export type TimetableReminderStatus =
  | "pending"
  | "sent"
  | "started"
  | "done"
  | "later"
  | "skipped"
  | "dismissed"
  | "cancelled";

export interface TimetableReminderDocument extends Document {
  firebaseUid: string;
  scheduleId: string;
  scheduleDate: string; // "YYYY-MM-DD"
  itemIndex: number;
  itemTitle: string;
  itemStart: string; // "HH:MM"
  itemEnd: string; // "HH:MM"
  itemType: string;
  uniqueKey: string; // `${scheduleId}_${itemIndex}`

  triggerAt: Date; // Start time in UTC
  nudgeAt: Date | null; // triggerAt + 15 min

  status: TimetableReminderStatus;
  initialSentAt: Date | null;
  nudgesSent: number;
  maxNudges: number;
  lastNudgeAt: Date | null;
  userDismissedCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const TimetableReminderSchema = new Schema<TimetableReminderDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    scheduleId: { type: String, required: true, index: true },
    scheduleDate: { type: String, required: true, index: true },
    itemIndex: { type: Number, required: true },
    itemTitle: { type: String, required: true },
    itemStart: { type: String, required: true },
    itemEnd: { type: String, required: true },
    itemType: { type: String, default: "task" },
    uniqueKey: { type: String, required: true, unique: true },

    triggerAt: { type: Date, required: true, index: true },
    nudgeAt: { type: Date, default: null, index: true },

    status: {
      type: String,
      enum: ["pending", "sent", "started", "done", "later", "skipped", "dismissed", "cancelled"],
      default: "pending",
      index: true,
    },
    initialSentAt: { type: Date, default: null },
    nudgesSent: { type: Number, default: 0 },
    maxNudges: { type: Number, default: 2 },
    lastNudgeAt: { type: Date, default: null },
    userDismissedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

TimetableReminderSchema.index({ status: 1, triggerAt: 1 });
TimetableReminderSchema.index({ status: 1, nudgeAt: 1 });
TimetableReminderSchema.index({ firebaseUid: 1, scheduleDate: 1 });

export const TimetableReminderModel: Model<TimetableReminderDocument> =
  mongoose.models.TimetableReminder ||
  mongoose.model<TimetableReminderDocument>("TimetableReminder", TimetableReminderSchema);

