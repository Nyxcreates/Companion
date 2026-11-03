import type { UserDocument } from "@/models/User";
import type { UserProfile } from "@/types/profile";
import { normalizeLivingEnvironmentId } from "@/lib/world/worldThemes";

/** Converts a Mongoose User document into the plain, JSON-safe shape sent to the client. Never leaks Mongo internals like _id or __v. */
export function toUserProfile(doc: UserDocument): UserProfile {
  return {
    firebaseUid: doc.firebaseUid,
    email: doc.email,
    displayName: doc.displayName,
    companionName: doc.companionName,
    timezone: doc.timezone ?? null,
    onboardingCompleted: doc.onboardingCompleted,
    introCompleted: doc.introCompleted ?? false,
    theme: doc.theme === "light" ? "light" : "dark",
    livingEnvironment: normalizeLivingEnvironmentId(doc.livingEnvironment),
    goals: doc.goals,
    customGoal: doc.customGoal,
    dailyRhythm: {
      wakeTime: doc.dailyRhythm?.wakeTime ?? null,
      sleepTime: doc.dailyRhythm?.sleepTime ?? null,
      focusPeriods: doc.dailyRhythm?.focusPeriods ?? [],
      commitments: doc.dailyRhythm?.commitments ?? null,
    },
    helpPreferences: doc.helpPreferences,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
