import mongoose, { Schema, type Document, type Model } from "mongoose";

export type BreakSessionStatus = "active" | "extended" | "ended" | "cancelled";

export interface BreakSessionDocument extends Document {
  firebaseUid: string;
  endsAt: Date;             // UTC — the original break end time
  status: BreakSessionStatus;
  extensionUsed: boolean;
  extensionEndsAt: Date | null;  // UTC — set when "5 more minutes" is used
  nextTaskTitle: string | null;  // next upcoming timetable item (may be null)
  durationMinutes: number;       // what the user chose (15 | 30 | 60 | custom)
  endNotificationSent: boolean;  // so we don't double-push
  createdAt: Date;
  updatedAt: Date;
}

const BreakSessionSchema = new Schema<BreakSessionDocument>(
  {
    firebaseUid:   { type: String, required: true, index: true },
    endsAt:        { type: Date,   required: true, index: true },
    status: {
      type: String,
      enum: ["active", "extended", "ended", "cancelled"],
      default: "active",
      index: true,
    },
    extensionUsed:        { type: Boolean, default: false },
    extensionEndsAt:      { type: Date,    default: null, index: true },
    nextTaskTitle:        { type: String,  default: null },
    durationMinutes:      { type: Number,  required: true },
    endNotificationSent:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Only one active break per user at a time is enforced at the service layer.
BreakSessionSchema.index({ firebaseUid: 1, status: 1 });
BreakSessionSchema.index({ status: 1, endsAt: 1 });
BreakSessionSchema.index({ status: 1, extensionEndsAt: 1 });

export const BreakSessionModel: Model<BreakSessionDocument> =
  mongoose.models.BreakSession ||
  mongoose.model<BreakSessionDocument>("BreakSession", BreakSessionSchema);

