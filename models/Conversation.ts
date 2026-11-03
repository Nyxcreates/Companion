import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * A conversation thread belonging to one user. For this milestone
 * there is exactly one meaningful conversation per user at a time —
 * see services/conversationService.ts's getOrCreateActiveConversation
 * — but the model itself makes no such assumption, so a future
 * "start a new conversation" feature is additive, not a migration.
 */
export interface ConversationDocument extends Document {
  firebaseUid: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<ConversationDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, default: null },
  },
  { timestamps: true }
);

// The hot lookup is "this user's most recently active conversation" —
// index the pair so it stays fast as conversations grow.
ConversationSchema.index({ firebaseUid: 1, updatedAt: -1 });

export const ConversationModel: Model<ConversationDocument> =
  mongoose.models.Conversation || mongoose.model<ConversationDocument>("Conversation", ConversationSchema);