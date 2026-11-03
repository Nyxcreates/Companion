import { connectToDatabase } from "@/lib/mongodb";
import { ScheduleModel, type ScheduleDocument } from "@/models/Schedule";
import { SchedulePersistenceError } from "@/lib/schedule/errors";
import type { ScheduleItem, ScheduleSummary } from "@/types/schedule";

function toSummary(doc: ScheduleDocument): ScheduleSummary {
  return {
    id: String(doc._id),
    date: doc.date,
    items: doc.items.map((i) => ({
      start: i.start,
      end: i.end,
      title: i.title,
      type: i.type,
      taskId: i.taskId ? String(i.taskId) : null,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Upserts by (firebaseUid, date) — regenerating a day's schedule replaces it rather than creating a duplicate. */
export async function saveSchedule(firebaseUid: string, date: string, items: ScheduleItem[]): Promise<ScheduleSummary> {
  try {
    await connectToDatabase();
    const doc = await ScheduleModel.findOneAndUpdate(
      { firebaseUid, date },
      { $set: { items } },
      { new: true, upsert: true }
    );
    return toSummary(doc);
  } catch (error) {
    throw new SchedulePersistenceError("save schedule", error);
  }
}

/** Returns null (never throws) if nothing has been generated yet for that date. */
export async function getSchedule(firebaseUid: string, date: string): Promise<ScheduleSummary | null> {
  try {
    await connectToDatabase();
    const doc = await ScheduleModel.findOne({ firebaseUid, date });
    return doc ? toSummary(doc) : null;
  } catch (error) {
    throw new SchedulePersistenceError("get schedule", error);
  }
}

/** Hard-deletes one day's schedule. Returns null if there's none for that date / not owned. */
export async function deleteSchedule(firebaseUid: string, date: string): Promise<boolean | null> {
  try {
    await connectToDatabase();
    const result = await ScheduleModel.deleteOne({ firebaseUid, date });
    return result.deletedCount > 0 ? true : null;
  } catch (error) {
    throw new SchedulePersistenceError("delete schedule", error);
  }
}