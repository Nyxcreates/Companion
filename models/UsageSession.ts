import mongoose, { Schema, type Document, type Model } from "mongoose";

export type UsageSessionType = "app_active" | "distraction_free";

export interface UsageSessionDocument extends Document {
  firebaseUid: string;
  type: UsageSessionType;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const UsageSessionSchema = new Schema<UsageSessionDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    type: { type: String, enum: ["app_active", "distraction_free"], required: true },
    durationSeconds: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

UsageSessionSchema.index({ firebaseUid: 1, startedAt: -1 });

export const UsageSessionModel: Model<UsageSessionDocument> =
  mongoose.models.UsageSession || mongoose.model<UsageSessionDocument>("UsageSession", UsageSessionSchema);

