import mongoose, { Schema, type Document, type Model } from "mongoose";

export type MessageRole = "user" | "assistant";

export interface MessageDocument extends Document {
  conversationId: mongoose.Types.ObjectId;
  firebaseUid: string;
  role: MessageRole;
  content: string;
  scheduleId?: mongoose.Types.ObjectId | string | null;
  scheduleDate?: string | null;
  scheduleSnapshot?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt?: Date;
}

const MessageSchema = new Schema<MessageDocument>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    firebaseUid: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: "Schedule", default: null },
    scheduleDate: { type: String, default: null },
    scheduleSnapshot: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// The hot path is always "recent messages for one conversation, in order".
MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const MessageModel: Model<MessageDocument> =
  mongoose.models.Message || mongoose.model<MessageDocument>("Message", MessageSchema);
