import mongoose, { Schema, type Document, type Model } from "mongoose";

export type CheckInAction = "accept" | "dismiss" | "snooze" | "talk" | "ignore";

export interface CheckInHistoryDocument extends Document {
  firebaseUid: string;
  triggerType: string; // e.g. "working_too_long", "stressed_mood", "late_night", "inactive", "task_waiting", "wellbeing_water"
  message: string;
  action: CheckInAction;
  interventionType?: string; // e.g. "break", "water", "stretch", "music", "chat", "sleep"
  createdAt: Date;
}

const CheckInHistorySchema = new Schema<CheckInHistoryDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    triggerType: { type: String, required: true },
    message: { type: String, required: true },
    action: {
      type: String,
      enum: ["accept", "dismiss", "snooze", "talk", "ignore"],
      required: true,
    },
    interventionType: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CheckInHistorySchema.index({ firebaseUid: 1, createdAt: -1 });

export const CheckInHistoryModel: Model<CheckInHistoryDocument> =
  mongoose.models.CheckInHistory ||
  mongoose.model<CheckInHistoryDocument>("CheckInHistory", CheckInHistorySchema);

