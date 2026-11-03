import mongoose, { Schema, type Document, type Model } from "mongoose";
import { MEMORY_TYPES, type MemoryType } from "@/lib/memory/types";

export type MemorySource = "explicit_request" | "inferred";
export type MemoryStatus = "active" | "deleted";

/**
 * A single long-term fact/preference/habit Nikki should carry across
 * conversations — distinct from conversation history (temporary),
 * Memory Capsules (deliberate messages to a future self), and the
 * journal (reflective writing). See the long-term-memory milestone
 * spec, section 2.
 *
 * `status` is a soft-delete flag, not a lifecycle like Capsule's
 * derived SEALED/UNLOCKED/OPENED — a memory is simply active or
 * deleted. It's a stored field (unlike Capsule's status) because
 * deletion here is a real, permanent user action, not something that
 * flips on its own over time.
 */
export interface MemoryDocument extends Document {
  firebaseUid: string;
  type: MemoryType;
  content: string;
  source: MemorySource;
  confidence: number;
  status: MemoryStatus;
  sourceMessageId: mongoose.Types.ObjectId | null;
  sourceConversationId: mongoose.Types.ObjectId | null;
  /** Bumped whenever this memory is pulled into a chat's context — a simple recency-based stand-in for real relevance scoring. Null until first used. */
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MemorySchema = new Schema<MemoryDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    type: { type: String, enum: MEMORY_TYPES, required: true },
    content: { type: String, required: true },
    source: { type: String, enum: ["explicit_request", "inferred"], required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    status: { type: String, enum: ["active", "deleted"], default: "active" },
    sourceMessageId: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    sourceConversationId: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hot paths: "this user's active memories, most recently used first"
// (context retrieval) and "...most recently created first" (the
// Memory settings list).
MemorySchema.index({ firebaseUid: 1, status: 1, lastUsedAt: -1 });
MemorySchema.index({ firebaseUid: 1, status: 1, createdAt: -1 });

export const MemoryModel: Model<MemoryDocument> =
  mongoose.models.Memory || mongoose.model<MemoryDocument>("Memory", MemorySchema);