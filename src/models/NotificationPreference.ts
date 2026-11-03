import mongoose, { Schema, type Document, type Model } from "mongoose";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "./Notification";
export type { NotificationCategory };

export type CheckInFrequency = "gentle" | "balanced" | "frequent";
export type FloatingPresenceMode = "always" | "subtle" | "off";

export interface LearnedInterventionWeights {
  waterDismissCount: number;
  waterAcceptCount: number;
  breakDismissCount: number;
  breakAcceptCount: number;
  preferredBreakActivity: string | null; // e.g. 'walk', 'music', 'stretch', 'water', 'eyes'
  lastInterventionAccepted: string | null;
}

export interface NotificationPreferenceDocument extends Document {
  firebaseUid: string;
  proactiveEnabled: boolean;
  categoriesEnabled: Record<NotificationCategory, boolean>;
  quietHoursStart: string | null; // e.g. "22:00"
  quietHoursEnd: string | null; // e.g. "07:00"
  checkInFrequency: CheckInFrequency;
  floatingPresence: FloatingPresenceMode;
  breakIntervalMinutes: number;
  waterIntervalMinutes: number;
  dailyPhoneGoalMinutes: number;
  pausedUntil: Date | null;
  learnedWeights: LearnedInterventionWeights;
  createdAt: Date;
  updatedAt: Date;
}

const defaultCategories = () => {
  const result: Record<string, boolean> = {};
  for (const cat of NOTIFICATION_CATEGORIES) {
    result[cat] = true;
  }
  return result;
};

const NotificationPreferenceSchema = new Schema<NotificationPreferenceDocument>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    proactiveEnabled: { type: Boolean, default: true },
    categoriesEnabled: {
      type: Map,
      of: Boolean,
      default: defaultCategories,
    },
    quietHoursStart: { type: String, default: "22:30" },
    quietHoursEnd: { type: String, default: "07:00" },
    checkInFrequency: {
      type: String,
      enum: ["gentle", "balanced", "frequent"],
      default: "balanced",
    },
    floatingPresence: {
      type: String,
      enum: ["always", "subtle", "off"],
      default: "always",
    },
    breakIntervalMinutes: { type: Number, default: 45 },
    waterIntervalMinutes: { type: Number, default: 90 },
    dailyPhoneGoalMinutes: { type: Number, default: 120 },
    pausedUntil: { type: Date, default: null },
    learnedWeights: {
      waterDismissCount: { type: Number, default: 0 },
      waterAcceptCount: { type: Number, default: 0 },
      breakDismissCount: { type: Number, default: 0 },
      breakAcceptCount: { type: Number, default: 0 },
      preferredBreakActivity: { type: String, default: null },
      lastInterventionAccepted: { type: String, default: null },
    },
  },
  { timestamps: true }
);

export const NotificationPreferenceModel: Model<NotificationPreferenceDocument> =
  mongoose.models.NotificationPreference ||
  mongoose.model<NotificationPreferenceDocument>("NotificationPreference", NotificationPreferenceSchema);
