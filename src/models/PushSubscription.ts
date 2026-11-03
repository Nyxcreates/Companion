import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface PushSubscriptionDocument extends Document {
  firebaseUid: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<PushSubscriptionDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    expirationTime: { type: Number, default: null },
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ firebaseUid: 1, endpoint: 1 }, { unique: true });

export const PushSubscriptionModel: Model<PushSubscriptionDocument> =
  mongoose.models.PushSubscription ||
  mongoose.model<PushSubscriptionDocument>("PushSubscription", PushSubscriptionSchema);

