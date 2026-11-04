import mongoose, { Schema, type Document, type Model } from "mongoose";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notifications/categories";

export { NOTIFICATION_CATEGORIES, type NotificationCategory };

export interface NotificationDocument extends Document {
  firebaseUid: string;
  category: NotificationCategory;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  dismissed: boolean;
  snoozedUntil: Date | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: NOTIFICATION_CATEGORIES,
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    actionUrl: { type: String, default: null },
    actionLabel: { type: String, default: null },
    read: { type: Boolean, default: false, index: true },
    dismissed: { type: Boolean, default: false, index: true },
    snoozedUntil: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

NotificationSchema.index({ firebaseUid: 1, dismissed: 1, createdAt: -1 });
NotificationSchema.index({ firebaseUid: 1, read: 1 });

export const NotificationModel: Model<NotificationDocument> =
  mongoose.models.Notification || mongoose.model<NotificationDocument>("Notification", NotificationSchema);

