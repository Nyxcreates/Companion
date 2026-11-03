import mongoose, { Schema, type Document, type Model } from "mongoose";
import { EMOTION_LABELS, type EmotionLabel } from "@/lib/ai/emotion";

/**
 * A journal entry: something the user chose to write about their day,
 * thoughts, or feelings.
 *
 * CRITICAL DISTINCTION (see the journal milestone spec, section 3):
 * this is NOT Long-Term Memory (models/Memory.ts). A journal entry is
 * user-authored reflection the user chose to write; a Memory is a
 * fact/preference Nikki intentionally retained for future
 * conversations. Saving a journal entry NEVER creates a Memory —
 * there is no code path from this model into MemoryModel, and none
 * should be added implicitly. See services/journalService.ts's doc
 * comment for the full explanation of where the two stay separate.
 *
 * `mood` reuses the app's one existing standardized emotion
 * vocabulary (lib/ai/emotion.ts's EmotionLabel — the same one
 * EmotionDocument uses for chat-turn readings) rather than inventing
 * a second, conflicting mood system. Optional and freely user-chosen
 * here — unlike EmotionDocument, this is never AI-inferred.
 */
export interface JournalEntryDocument extends Document {
  firebaseUid: string;
  title: string | null;
  content: string;
  mood: EmotionLabel | null;
  createdAt: Date;
  updatedAt: Date;
}

const JournalEntrySchema = new Schema<JournalEntryDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, default: null },
    content: { type: String, required: true },
    mood: { type: String, enum: EMOTION_LABELS, default: null },
  },
  { timestamps: true }
);

// The one hot lookup: "this user's entries, most recent first" —
// both Journal Home's recent list and full chronological browsing use
// exactly this shape.
JournalEntrySchema.index({ firebaseUid: 1, createdAt: -1 });

export const JournalEntryModel: Model<JournalEntryDocument> =
  mongoose.models.JournalEntry || mongoose.model<JournalEntryDocument>("JournalEntry", JournalEntrySchema);