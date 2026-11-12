import { connectToDatabase } from "@/lib/mongodb";
import { TimetableReminderModel, type TimetableReminderDocument } from "@/models/TimetableReminder";
import { UserModel, type UserDocument } from "@/models/User";
import { NotificationPreferenceModel, type NotificationPreferenceDocument } from "@/models/NotificationPreference";
import { NotificationModel } from "@/models/Notification";
import { sendPushToUser } from "@/lib/pushService";
import { resolveUserTimezone, parseDateTimeInTimezone } from "@/lib/time/currentTime";
import type { ScheduleSummary } from "@/types/schedule";

/** Returns true if local time in timezone tz is within quiet hours */
function isQuietHours(start: string | null, end: string | null, tz: string): boolean {
  if (!start || !end) return false;
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const currentMins = hour * 60 + minute;

    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const startMins = startH * 60 + (startM || 0);
    const endMins = endH * 60 + (endM || 0);

    if (startMins <= endMins) {
      return currentMins >= startMins && currentMins < endMins;
    }
    return currentMins >= startMins || currentMins < endMins;
  } catch {
    return false;
  }
}

/**
 * Syncs timetable reminders when a schedule is created, regenerated, or updated.
 *
 * Idempotent, owner-scoped, and timezone-safe.
 * Uses a unique composite key (`${scheduleId}_${itemIndex}`) so repeats don't duplicate.
 */
export async function syncTimetableReminders(
  firebaseUid: string,
  schedule: ScheduleSummary
): Promise<void> {
  await connectToDatabase();

  const user = await UserModel.findOne({ firebaseUid });
  const timezone = resolveUserTimezone(null, user?.timezone);

  const activeIndices = new Set<number>();

  for (let i = 0; i < schedule.items.length; i++) {
    const item = schedule.items[i];
    if (!item.title || !item.start || item.type === "free") continue;

    activeIndices.add(i);

    const triggerAt = parseDateTimeInTimezone(schedule.date, item.start, timezone);
    const nudgeAt = new Date(triggerAt.getTime() + 15 * 60 * 1000);
    const uniqueKey = `${schedule.id}_${i}`;

    await TimetableReminderModel.findOneAndUpdate(
      { uniqueKey },
      {
        $set: {
          firebaseUid,
          scheduleId: schedule.id,
          scheduleDate: schedule.date,
          itemIndex: i,
          itemTitle: item.title,
          itemStart: item.start,
          itemEnd: item.end,
          itemType: item.type,
          triggerAt,
          nudgeAt,
        },
        $setOnInsert: {
          status: "pending",
          nudgesSent: 0,
          maxNudges: 2,
          userDismissedCount: 0,
          initialSentAt: null,
          lastNudgeAt: null,
        },
      },
      { upsert: true, new: true }
    );
  }

  // Cancel any trailing reminders if schedule was updated with fewer items
  await TimetableReminderModel.updateMany(
    {
      firebaseUid,
      scheduleId: schedule.id,
      itemIndex: { $nin: Array.from(activeIndices) },
      status: "pending",
    },
    { $set: { status: "cancelled" } }
  );
}

/**
 * Cancels pending timetable reminders when a schedule is deleted.
 */
export async function cancelTimetableRemindersForDate(
  firebaseUid: string,
  date: string
): Promise<void> {
  await connectToDatabase();
  await TimetableReminderModel.updateMany(
    {
      firebaseUid,
      scheduleDate: date,
      status: "pending",
    },
    { $set: { status: "cancelled" } }
  );
}

/**
 * Evaluates and dispatches due timetable reminders and follow-up nudges.
 *
 * Called on schedule by cron (e.g. /api/cron/dispatch or /api/cron/evaluate).
 * Respects quiet hours, paused status, proactive preferences, and category toggles.
 */
export async function dispatchDueTimetableReminders(): Promise<{
  initialRemindersSent: number;
  nudgesSent: number;
  totalEvaluated: number;
}> {
  await connectToDatabase();
  const now = new Date();

  let initialRemindersSent = 0;
  let nudgesSent = 0;

  // Cache user models and preferences during this dispatch run
  const userCache = new Map<string, UserDocument | null>();
  const prefsCache = new Map<string, NotificationPreferenceDocument | null>();

  async function getUser(uid: string): Promise<UserDocument | null> {
    if (!userCache.has(uid)) {
      userCache.set(uid, await UserModel.findOne({ firebaseUid: uid }));
    }
    return userCache.get(uid) ?? null;
  }

  async function getPrefs(uid: string): Promise<NotificationPreferenceDocument | null> {
    if (!prefsCache.has(uid)) {
      prefsCache.set(uid, await NotificationPreferenceModel.findOne({ firebaseUid: uid }));
    }
    return prefsCache.get(uid) ?? null;
  }

  // ── Phase 1: Due Start-Time Reminders (status: pending, triggerAt <= now) ──
  const dueInitials = await TimetableReminderModel.find({
    status: "pending",
    triggerAt: { $lte: now },
  }).limit(50);

  for (const reminder of dueInitials) {
    const user = await getUser(reminder.firebaseUid);
    const prefs = await getPrefs(reminder.firebaseUid);
    const tz = resolveUserTimezone(null, user?.timezone);

    // 1. Respect paused state
    if (prefs?.pausedUntil && new Date(prefs.pausedUntil) > now) {
      continue;
    }

    // 2. Respect proactive setting
    if (prefs?.proactiveEnabled === false) {
      reminder.status = "cancelled";
      await reminder.save();
      continue;
    }

    // 3. Respect category settings (timetable_reminder)
    const category = reminder.itemType === "commitment" ? "commitment_reminder" : "timetable_reminder";
    if (prefs?.categoriesEnabled) {
      const isEnabled = prefs.categoriesEnabled instanceof Map
        ? prefs.categoriesEnabled.get(category) !== false
        : (prefs.categoriesEnabled as Record<string, boolean>)[category] !== false;
      if (!isEnabled) {
        reminder.status = "cancelled";
        await reminder.save();
        continue;
      }
    }

    // 4. Respect quiet hours
    if (isQuietHours(prefs?.quietHoursStart ?? null, prefs?.quietHoursEnd ?? null, tz)) {
      // In quiet hours: don't disturb with push notification
      reminder.status = "sent";
      reminder.initialSentAt = now;
      await reminder.save();
      continue;
    }

    // 5. Send caring start notification
    const companionName = user?.companionName || "Nikki";
    const userName = user?.displayName?.trim() || "friend";
    const body =
      reminder.itemType === "commitment"
        ? `Hey ${userName}, your ${reminder.itemTitle} starts now. Hope you have a wonderful time! ✨`
        : `Hey ${userName}, time for "${reminder.itemTitle}"! Ready to get started? ✨`;

    await sendPushToUser(reminder.firebaseUid, {
      title: `${companionName} ✨`,
      body,
      url: "/plan?tab=schedule",
      category,
      tag: `timetable-${reminder.uniqueKey}`,
      actions: [
        { action: "start", title: "Starting now" },
        { action: "later", title: "Later" },
        { action: "skip", title: "Skip" },
      ],
      data: {
        reminderId: String(reminder._id),
        uniqueKey: reminder.uniqueKey,
        scheduleId: reminder.scheduleId,
        itemIndex: reminder.itemIndex,
        url: "/plan?tab=schedule",
      },
    });

    // Also persist in in-app notifications
    await NotificationModel.create({
      firebaseUid: reminder.firebaseUid,
      category,
      title: `${companionName} ✨`,
      body,
      actionUrl: "/plan?tab=schedule",
      actionLabel: "View Timetable",
      metadata: { reminderId: String(reminder._id), uniqueKey: reminder.uniqueKey },
    });

    reminder.status = "sent";
    reminder.initialSentAt = now;
    reminder.nudgeAt = new Date(reminder.triggerAt.getTime() + 15 * 60 * 1000);
    await reminder.save();
    initialRemindersSent++;
  }

  // ── Phase 2: Due Follow-Up Nudges (15 minutes after start) ─────────────────
  const dueNudges = await TimetableReminderModel.find({
    status: "sent",
    nudgeAt: { $ne: null, $lte: now },
  }).limit(50);

  for (const reminder of dueNudges) {
    // Back off: max 2 nudges per item, fewer if user dismissed earlier ones
    const allowedNudges = Math.max(0, reminder.maxNudges - reminder.userDismissedCount);
    if (reminder.nudgesSent >= allowedNudges || allowedNudges === 0) {
      // Reached back-off threshold, no further nudges
      reminder.nudgeAt = null;
      await reminder.save();
      continue;
    }

    const user = await getUser(reminder.firebaseUid);
    const prefs = await getPrefs(reminder.firebaseUid);
    const tz = resolveUserTimezone(null, user?.timezone);

    if (prefs?.pausedUntil && new Date(prefs.pausedUntil) > now) {
      continue;
    }

    if (prefs?.proactiveEnabled === false) {
      reminder.nudgeAt = null;
      await reminder.save();
      continue;
    }

    const category = reminder.itemType === "commitment" ? "commitment_reminder" : "timetable_reminder";
    if (prefs?.categoriesEnabled) {
      const isEnabled = prefs.categoriesEnabled instanceof Map
        ? prefs.categoriesEnabled.get(category) !== false
        : (prefs.categoriesEnabled as Record<string, boolean>)[category] !== false;
      if (!isEnabled) {
        reminder.nudgeAt = null;
        await reminder.save();
        continue;
      }
    }

    if (isQuietHours(prefs?.quietHoursStart ?? null, prefs?.quietHoursEnd ?? null, tz)) {
      reminder.nudgeAt = null;
      await reminder.save();
      continue;
    }

    const companionName = user?.companionName || "Nikki";
    const userName = user?.displayName?.trim() || "friend";
    const nudgeBody = `Hey ${userName}, '${reminder.itemTitle}' started 15 minutes ago. Want to begin now or move it?`;

    await sendPushToUser(reminder.firebaseUid, {
      title: `${companionName} ✨`,
      body: nudgeBody,
      url: "/plan?tab=schedule",
      category,
      tag: `timetable-nudge-${reminder.uniqueKey}`,
      actions: [
        { action: "start", title: "Starting now" },
        { action: "later", title: "Later" },
        { action: "skip", title: "Skip" },
      ],
      data: {
        reminderId: String(reminder._id),
        uniqueKey: reminder.uniqueKey,
        scheduleId: reminder.scheduleId,
        itemIndex: reminder.itemIndex,
        url: "/plan?tab=schedule",
      },
    });

    await NotificationModel.create({
      firebaseUid: reminder.firebaseUid,
      category,
      title: `${companionName} ✨`,
      body: nudgeBody,
      actionUrl: "/plan?tab=schedule",
      actionLabel: "View Timetable",
      metadata: { reminderId: String(reminder._id), uniqueKey: reminder.uniqueKey, isNudge: true },
    });

    reminder.nudgesSent += 1;
    reminder.lastNudgeAt = now;

    // Back off: if reached limit, stop nudges; otherwise schedule next 15m check
    if (reminder.nudgesSent >= allowedNudges) {
      reminder.nudgeAt = null;
    } else {
      reminder.nudgeAt = new Date(now.getTime() + 15 * 60 * 1000);
    }

    await reminder.save();
    nudgesSent++;
  }

  return {
    initialRemindersSent,
    nudgesSent,
    totalEvaluated: dueInitials.length + dueNudges.length,
  };
}

/**
 * Handles user interaction responses to timetable reminders (Starting now, Later, Skip, Dismiss).
 */
export async function handleReminderAction(params: {
  reminderId?: string;
  uniqueKey?: string;
  action: string;
  firebaseUid?: string;
}): Promise<{ success: boolean; status?: string }> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (params.reminderId) query._id = params.reminderId;
  else if (params.uniqueKey) query.uniqueKey = params.uniqueKey;
  else return { success: false };

  if (params.firebaseUid) {
    query.firebaseUid = params.firebaseUid;
  }

  const reminder = await TimetableReminderModel.findOne(query);
  if (!reminder) return { success: false };

  switch (params.action) {
    case "start":
      reminder.status = "started";
      reminder.nudgeAt = null;
      break;
    case "done":
      reminder.status = "done";
      reminder.nudgeAt = null;
      break;
    case "skip":
      reminder.status = "skipped";
      reminder.nudgeAt = null;
      break;
    case "later":
      reminder.status = "later";
      reminder.nudgeAt = new Date(Date.now() + 15 * 60 * 1000);
      break;
    case "dismiss":
      reminder.userDismissedCount += 1;
      const allowed = Math.max(0, reminder.maxNudges - reminder.userDismissedCount);
      if (reminder.nudgesSent >= allowed) {
        reminder.nudgeAt = null;
      }
      break;
    default:
      break;
  }

  await reminder.save();
  return { success: true, status: reminder.status };
}

