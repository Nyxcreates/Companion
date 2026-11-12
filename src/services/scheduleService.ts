import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ScheduleModel, type ScheduleDocument } from "@/models/Schedule";
import { SchedulePersistenceError } from "@/lib/schedule/errors";
import { syncTimetableReminders, cancelTimetableRemindersForDate } from "@/services/timetableReminderService";
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
    const summary = toSummary(doc);
    try {
      await syncTimetableReminders(firebaseUid, summary);
    } catch (syncErr) {
      console.error("[Companion] Failed to sync timetable reminders:", syncErr);
    }
    return summary;
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

/** Returns null if not found or not owned by this firebaseUid. */
export async function getScheduleById(
  firebaseUid: string,
  id: string | mongoose.Types.ObjectId
): Promise<ScheduleSummary | null> {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  try {
    await connectToDatabase();
    const doc = await ScheduleModel.findOne({ _id: id, firebaseUid });
    return doc ? toSummary(doc) : null;
  } catch (error) {
    throw new SchedulePersistenceError("get schedule by id", error);
  }
}

/** Hydrates multiple schedules by dates, owner-scoped by firebaseUid. */
export async function getSchedulesByDates(
  firebaseUid: string,
  dates: string[]
): Promise<Map<string, ScheduleSummary>> {
  const map = new Map<string, ScheduleSummary>();
  const validDates = dates.filter((d): d is string => typeof d === "string" && Boolean(d));
  if (validDates.length === 0) return map;
  try {
    await connectToDatabase();
    const docs = await ScheduleModel.find({ firebaseUid, date: { $in: validDates } });
    for (const doc of docs) {
      map.set(doc.date, toSummary(doc));
    }
    return map;
  } catch (error) {
    throw new SchedulePersistenceError("get schedules by dates", error);
  }
}

/** Hydrates multiple schedules by Mongo ObjectIds, owner-scoped by firebaseUid. */
export async function getSchedulesByIds(
  firebaseUid: string,
  ids: (string | mongoose.Types.ObjectId)[]
): Promise<Map<string, ScheduleSummary>> {
  const map = new Map<string, ScheduleSummary>();
  const validIds = ids.filter((id) => Boolean(id) && mongoose.isValidObjectId(id));
  if (validIds.length === 0) return map;
  try {
    await connectToDatabase();
    const docs = await ScheduleModel.find({ firebaseUid, _id: { $in: validIds } });
    for (const doc of docs) {
      map.set(String(doc._id), toSummary(doc));
    }
    return map;
  } catch (error) {
    throw new SchedulePersistenceError("get schedules by ids", error);
  }
}

/** Hard-deletes one day's schedule. Returns null if there's none for that date / not owned. */
export async function deleteSchedule(firebaseUid: string, date: string): Promise<boolean | null> {
  try {
    await connectToDatabase();
    const result = await ScheduleModel.deleteOne({ firebaseUid, date });
    if (result.deletedCount > 0) {
      try {
        await cancelTimetableRemindersForDate(firebaseUid, date);
      } catch (cancelErr) {
        console.error("[Companion] Failed to cancel timetable reminders:", cancelErr);
      }
      return true;
    }
    return null;
  } catch (error) {
    throw new SchedulePersistenceError("delete schedule", error);
  }
}