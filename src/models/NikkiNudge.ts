import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { NikkiStrictness } from "@/types/notification";

export type NikkiNudgeStatus = "created" | "delivered" | "replied" | "dismissed" | "expired";

export type NikkiTrigger =
  | "no_timetable"
  | "morning_plan"
  | "timetable_unstarted"
  | "task_overdue"
  | "late_night"
  | "long_session"
  | "long_silence"
  | "mood_followup";

export interface NikkiNudgeDocument extends Document {
  firebaseUid: string;
  trigger: NikkiTrigger;
  message: string;
  status: NikkiNudgeStatus;
  idempotencyKey: string;
  strictness: NikkiStrictness;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NikkiNudgeSchema = new Schema<NikkiNudgeDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    trigger: {
      type: String,
      enum: [
        "no_timetable",
        "morning_plan",
        "timetable_unstarted",
        "task_overdue",
        "late_night",
        "long_session",
        "long_silence",
        "mood_followup",
      ],
      required: true,
      index: true,
    },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["created", "delivered", "replied", "dismissed", "expired"],
      default: "created",
      index: true,
    },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    strictness: {
      type: String,
      enum: ["gentle", "playful", "firm"],
      default: "playful",
    },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

NikkiNudgeSchema.index({ firebaseUid: 1, createdAt: -1 });
NikkiNudgeSchema.index({ firebaseUid: 1, trigger: 1, createdAt: -1 });
NikkiNudgeSchema.index({ status: 1, createdAt: -1 });

export const NikkiNudgeModel: Model<NikkiNudgeDocument> =
  mongoose.models.NikkiNudge ||
  mongoose.model<NikkiNudgeDocument>("NikkiNudge", NikkiNudgeSchema);

