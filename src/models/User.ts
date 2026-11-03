import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { LivingEnvironmentId } from "@/types/profile";

export interface DailyRhythmSubdoc {
  wakeTime: string | null;
  sleepTime: string | null;
  focusPeriods: string[];
  commitments: string | null;
}

export interface UserDocument extends Document {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  companionName: string | null;
  timezone: string | null;
  onboardingCompleted: boolean;
  introCompleted: boolean;
  theme: "dark" | "light";
  livingEnvironment: LivingEnvironmentId;
  goals: string[];
  customGoal: string | null;
  dailyRhythm: DailyRhythmSubdoc;
  helpPreferences: string[];
  xp: number;
  coins: number;
  level: number;
  createdAt: Date;
  updatedAt: Date;
}

const DailyRhythmSchema = new Schema<DailyRhythmSubdoc>(
  {
    wakeTime: { type: String, default: null },
    sleepTime: { type: String, default: null },
    focusPeriods: { type: [String], default: [] },
    commitments: { type: String, default: null },
  },
  { _id: false }
);

const UserSchema = new Schema<UserDocument>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: null },
    displayName: { type: String, default: null },
    companionName: { type: String, default: null },
    timezone: { type: String, default: null },
    onboardingCompleted: { type: Boolean, default: false },
    introCompleted: { type: Boolean, default: false },
    theme: { type: String, enum: ["dark", "light"], default: "dark" },
    livingEnvironment: {
      type: String,
      enum: [
        "cosmic-dream",
        "enchanted-garden",
        "abyssal-dreams",
        "midnight-academia",
        "moonlit-sakura",
        "aurora-sanctuary",
        "autumn-reverie",
        "cloud-kingdom",
        "space",
        "garden",
        "ocean",
      ],
      default: "cosmic-dream",
    },
    goals: { type: [String], default: [] },
    customGoal: { type: String, default: null },
    dailyRhythm: { type: DailyRhythmSchema, default: () => ({}) },
    helpPreferences: { type: [String], default: [] },
    xp: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const UserModel: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);
