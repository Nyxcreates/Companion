import mongoose, { Schema, type Document, type Model } from "mongoose";
import { EMOTION_LABELS, type EmotionLabel } from "@/lib/ai/emotion";

export interface EmotionDocument extends Document {
  firebaseUid: string;
  conversationId: mongoose.Types.ObjectId;
  sourceMessageId: mongoose.Types.ObjectId;
  emotion: EmotionLabel;
  intensity: number;
  confidence: number;
  secondaryEmotion: EmotionLabel | null;
  createdAt: Date;
}

const EmotionSchema = new Schema<EmotionDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sourceMessageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    emotion: { type: String, enum: EMOTION_LABELS, required: true },
    intensity: { type: Number, min: 0, max: 1, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    secondaryEmotion: { type: String, enum: EMOTION_LABELS, default: null },
  },
  // Observations are immutable snapshots — no updatedAt needed.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Future mood-timeline features will always query "this user's
// emotion history, most recent first" — index that shape now.
EmotionSchema.index({ firebaseUid: 1, createdAt: -1 });

export const EmotionModel: Model<EmotionDocument> =
  mongoose.models.Emotion || mongoose.model<EmotionDocument>("Emotion", EmotionSchema);