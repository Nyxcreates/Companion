import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { NikkiStrictness } from "@/types/notification";

export type NikkiNudgeStatus = "created" | "delivered" | "replied" | "dismissed" | "expired";

export type NikkiTrigger =
  | "no_timetable"
  | "morning_plan"
  | "morning_checkin"
  | "evening_checkin"
  | "timetable_unstarted"
  | "activity_missed"
  | "task_unfinished"
  | "deadline_approaching"
  | "task_overdue"
  | "goal_neglected"
  | "focus_finished"
  | "late_night"
  | "unusually_late"
  | "long_session"
  | "long_silence"
  | "user_inactive"
  | "user_returned"
  | "app_opened"
  | "mood_followup"
  | "task_celebration"
  | "overload_warning";

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
        "morning_checkin",
        "evening_checkin",
        "timetable_unstarted",
        "activity_missed",
        "task_unfinished",
        "deadline_approaching",
        "task_overdue",
        "goal_neglected",
        "focus_finished",
        "late_night",
        "unusually_late",
        "long_session",
        "long_silence",
        "user_inactive",
        "user_returned",
        "app_opened",
        "mood_followup",
        "task_celebration",
        "overload_warning",
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

