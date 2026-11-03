/** Client-facing shapes for the Journal system — mirrors src/types/task.ts's/capsule.ts's pattern (plain, JSON-safe, no Mongo internals). */

import type { EmotionLabel } from "@/lib/ai/emotion";

export interface JournalEntry {
  id: string;
  title: string | null;
  content: string;
  mood: EmotionLabel | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJournalEntryInput {
  title?: string;
  content: string;
  mood?: EmotionLabel;
}

/** Partial update — only supplied fields change. Pass `null` for title/mood to explicitly clear them. */
export interface UpdateJournalEntryInput {
  title?: string | null;
  content?: string;
  mood?: EmotionLabel | null;
}