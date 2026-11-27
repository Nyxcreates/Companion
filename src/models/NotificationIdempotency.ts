import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface NotificationIdempotencyDocument extends Document {
  key: string;
  firebaseUid: string;
  source: string;
  expiresAt: Date;
  createdAt: Date;
}

const NotificationIdempotencySchema = new Schema<NotificationIdempotencyDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    firebaseUid: { type: String, required: true, index: true },
    source: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// MongoDB TTL index automatically removes expired idempotency records.
NotificationIdempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const NotificationIdempotencyModel: Model<NotificationIdempotencyDocument> =
  mongoose.models.NotificationIdempotency ||
  mongoose.model<NotificationIdempotencyDocument>(
    "NotificationIdempotency",
    NotificationIdempotencySchema
  );

/**
 * Atomically claims an idempotency key in MongoDB before sending a notification.
 * Returns `true` if this invocation claimed the key, or `false` if it was
 * already claimed by an earlier or concurrent invocation.
 */
export async function claimNotificationIdempotency(
  key: string,
  firebaseUid: string,
  source: string,
  ttlMs: number
): Promise<boolean> {
  try {
    await NotificationIdempotencyModel.create({
      key,
      firebaseUid,
      source,
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return true;
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr?.code === 11000) {
      return false;
    }
    throw err;
  }
}
