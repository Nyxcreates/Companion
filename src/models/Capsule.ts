import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * A Memory Capsule: a message the user deliberately writes to their
 * future self, sealed until an unlock condition is met.
 *
 * Only date-based unlocking is implemented in this milestone. The
 * model intentionally does NOT store a redundant `status` field —
 * SEALED / UNLOCKED / OPENED is always derived from `unlockAt` vs.
 * the current time plus whether `openedAt` is set (see
 * lib/capsules/unlock.ts#computeCapsuleStatus), so there is exactly
 * one source of truth and no risk of a stored status drifting out of
 * sync with the actual unlock time.
 *
 * Future milestone/goal-based unlocking can be added additively —
 * e.g. an `unlockType: "date" | "milestone" | "goal"` discriminator
 * plus condition-specific fields — without migrating existing
 * capsules, since every capsule created today is implicitly a date
 * capsule.
 */
export interface CapsuleDocument extends Document {
  firebaseUid: string;
  title: string | null;
  message: string;
  unlockAt: Date;
  /** Human-readable label for how the unlock date was chosen (e.g. "3 months"), display-only — never authoritative for unlock logic. Null for capsules created with an explicit date. */
  relativeDurationLabel: string | null;
  openedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CapsuleSchema = new Schema<CapsuleDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, default: null },
    message: { type: String, required: true },
    unlockAt: { type: Date, required: true },
    relativeDurationLabel: { type: String, default: null },
    openedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The hot lookup is always "this user's capsules, soonest-unlock-first".
CapsuleSchema.index({ firebaseUid: 1, unlockAt: 1 });

export const CapsuleModel: Model<CapsuleDocument> =
  mongoose.models.Capsule || mongoose.model<CapsuleDocument>("Capsule", CapsuleSchema);