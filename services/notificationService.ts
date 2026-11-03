import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { NotificationModel, type NotificationDocument, type NotificationCategory } from "@/models/Notification";
import {
  NotificationPreferenceModel,
  type NotificationPreferenceDocument,
  type CheckInFrequency,
  type FloatingPresenceMode,
} from "@/models/NotificationPreference";
import { CheckInHistoryModel, type CheckInAction } from "@/models/CheckInHistory";
import { TaskModel } from "@/models/Task";
import { GoalModel } from "@/models/Goal";
import { ScheduleModel } from "@/models/Schedule";
import { FocusSessionModel } from "@/models/FocusSession";
import { EmotionModel } from "@/models/Emotion";
import type { NotificationItem, NotificationPreferences, CheckInTrigger } from "@/types/notification";

function docToNotificationItem(doc: NotificationDocument): NotificationItem {
  return {
    id: String(doc._id),
    category: doc.category,
    title: doc.title,
    body: doc.body,
    actionUrl: doc.actionUrl ?? null,
    actionLabel: doc.actionLabel ?? null,
    read: doc.read,
    dismissed: doc.dismissed,
    snoozedUntil: doc.snoozedUntil ? doc.snoozedUntil.toISOString() : null,
    metadata: doc.metadata as Record<string, unknown> | undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function docToPreferences(doc: NotificationPreferenceDocument): NotificationPreferences {
  const catMap: Record<string, boolean> = {};
  if (doc.categoriesEnabled) {
    if (doc.categoriesEnabled instanceof Map) {
      for (const [k, v] of doc.categoriesEnabled.entries()) {
        catMap[k] = v;
      }
    } else {
      Object.assign(catMap, doc.categoriesEnabled);
    }
  }

  return {
    proactiveEnabled: doc.proactiveEnabled ?? true,
    categoriesEnabled: catMap as Record<NotificationCategory, boolean>,
    quietHoursStart: doc.quietHoursStart ?? "22:30",
    quietHoursEnd: doc.quietHoursEnd ?? "07:00",
    checkInFrequency: (doc.checkInFrequency as CheckInFrequency) ?? "balanced",
    floatingPresence: (doc.floatingPresence as FloatingPresenceMode) ?? "always",
    breakIntervalMinutes: doc.breakIntervalMinutes ?? 45,
    waterIntervalMinutes: doc.waterIntervalMinutes ?? 90,
    dailyPhoneGoalMinutes: doc.dailyPhoneGoalMinutes ?? 120,
    pausedUntil: doc.pausedUntil ? doc.pausedUntil.toISOString() : null,
    learnedWeights: {
      waterDismissCount: doc.learnedWeights?.waterDismissCount ?? 0,
      waterAcceptCount: doc.learnedWeights?.waterAcceptCount ?? 0,
      breakDismissCount: doc.learnedWeights?.breakDismissCount ?? 0,
      breakAcceptCount: doc.learnedWeights?.breakAcceptCount ?? 0,
      preferredBreakActivity: doc.learnedWeights?.preferredBreakActivity ?? null,
      lastInterventionAccepted: doc.learnedWeights?.lastInterventionAccepted ?? null,
    },
  };
}

export async function getOrCreatePreferences(firebaseUid: string): Promise<NotificationPreferences> {
  await connectToDatabase();
  let doc = await NotificationPreferenceModel.findOne({ firebaseUid });
  if (!doc) {
    doc = await NotificationPreferenceModel.create({ firebaseUid });
  }
  return docToPreferences(doc);
}

export async function updatePreferences(
  firebaseUid: string,
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  await connectToDatabase();
  let doc = await NotificationPreferenceModel.findOne({ firebaseUid });
  if (!doc) {
    doc = new NotificationPreferenceModel({ firebaseUid });
  }

  if (updates.proactiveEnabled !== undefined) doc.proactiveEnabled = updates.proactiveEnabled;
  if (updates.quietHoursStart !== undefined) doc.quietHoursStart = updates.quietHoursStart;
  if (updates.quietHoursEnd !== undefined) doc.quietHoursEnd = updates.quietHoursEnd;
  if (updates.checkInFrequency !== undefined) doc.checkInFrequency = updates.checkInFrequency;
  if (updates.floatingPresence !== undefined) doc.floatingPresence = updates.floatingPresence;
  if (updates.breakIntervalMinutes !== undefined) doc.breakIntervalMinutes = updates.breakIntervalMinutes;
  if (updates.waterIntervalMinutes !== undefined) doc.waterIntervalMinutes = updates.waterIntervalMinutes;
  if (updates.dailyPhoneGoalMinutes !== undefined) doc.dailyPhoneGoalMinutes = updates.dailyPhoneGoalMinutes;
  if (updates.pausedUntil !== undefined) {
    doc.pausedUntil = updates.pausedUntil ? new Date(updates.pausedUntil) : null;
  }
  if (updates.categoriesEnabled !== undefined) {
    doc.categoriesEnabled = updates.categoriesEnabled as any;
  }

  await doc.save();
  return docToPreferences(doc);
}

export async function resetLearnedPreferences(firebaseUid: string): Promise<NotificationPreferences> {
  await connectToDatabase();
  const doc = await NotificationPreferenceModel.findOneAndUpdate(
    { firebaseUid },
    {
      $set: {
        learnedWeights: {
          waterDismissCount: 0,
          waterAcceptCount: 0,
          breakDismissCount: 0,
          breakAcceptCount: 0,
          preferredBreakActivity: null,
          lastInterventionAccepted: null,
        },
      },
    },
    { new: true, upsert: true }
  );
  return docToPreferences(doc);
}

export async function listUserNotifications(
  firebaseUid: string,
  options: { includeDismissed?: boolean; limit?: number } = {}
): Promise<NotificationItem[]> {
  await connectToDatabase();
  const now = new Date();
  const query: mongoose.FilterQuery<NotificationDocument> = { firebaseUid };

  if (!options.includeDismissed) {
    query.dismissed = false;
  }

  // Hide snoozed items until their snooze expires
  query.$or = [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }];

  const docs = await NotificationModel.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit ?? 50);

  return docs.map(docToNotificationItem);
}

export async function getUnreadNotificationCount(firebaseUid: string): Promise<number> {
  await connectToDatabase();
  const now = new Date();
  return NotificationModel.countDocuments({
    firebaseUid,
    read: false,
    dismissed: false,
    $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }],
  });
}

export async function markNotificationAsRead(
  firebaseUid: string,
  notificationId: string
): Promise<NotificationItem | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(notificationId)) return null;

  const doc = await NotificationModel.findOneAndUpdate(
    { _id: notificationId, firebaseUid },
    { $set: { read: true } },
    { new: true }
  );

  return doc ? docToNotificationItem(doc) : null;
}

export async function markAllNotificationsAsRead(firebaseUid: string): Promise<{ count: number }> {
  await connectToDatabase();
  const result = await NotificationModel.updateMany(
    { firebaseUid, read: false, dismissed: false },
    { $set: { read: true } }
  );
  return { count: result.modifiedCount };
}

export async function dismissNotification(
  firebaseUid: string,
  notificationId: string
): Promise<boolean> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(notificationId)) return false;

  const result = await NotificationModel.updateOne(
    { _id: notificationId, firebaseUid },
    { $set: { dismissed: true, read: true } }
  );
  return result.modifiedCount > 0;
}

export async function snoozeNotification(
  firebaseUid: string,
  notificationId: string,
  minutes = 30
): Promise<NotificationItem | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(notificationId)) return null;

  const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
  const doc = await NotificationModel.findOneAndUpdate(
    { _id: notificationId, firebaseUid },
    { $set: { snoozedUntil } },
    { new: true }
  );

  return doc ? docToNotificationItem(doc) : null;
}

export async function clearNotificationHistory(firebaseUid: string): Promise<{ count: number }> {
  await connectToDatabase();
  const result = await NotificationModel.deleteMany({ firebaseUid });
  return { count: result.deletedCount };
}

export async function recordCheckInResponse(
  firebaseUid: string,
  data: {
    triggerType: string;
    message: string;
    action: CheckInAction;
    interventionType?: string;
  }
): Promise<void> {
  await connectToDatabase();

  await CheckInHistoryModel.create({
    firebaseUid,
    triggerType: data.triggerType,
    message: data.message,
    action: data.action,
    interventionType: data.interventionType ?? null,
  });

  const pref = await NotificationPreferenceModel.findOne({ firebaseUid });
  if (!pref) return;

  const weights = pref.learnedWeights || {
    waterDismissCount: 0,
    waterAcceptCount: 0,
    breakDismissCount: 0,
    breakAcceptCount: 0,
    preferredBreakActivity: null,
    lastInterventionAccepted: null,
  };

  if (data.interventionType === "water") {
    if (data.action === "dismiss" || data.action === "ignore") {
      weights.waterDismissCount = (weights.waterDismissCount || 0) + 1;
    } else if (data.action === "accept") {
      weights.waterAcceptCount = (weights.waterAcceptCount || 0) + 1;
      weights.lastInterventionAccepted = "water";
    }
  } else if (data.interventionType === "break") {
    if (data.action === "dismiss" || data.action === "ignore") {
      weights.breakDismissCount = (weights.breakDismissCount || 0) + 1;
    } else if (data.action === "accept") {
      weights.breakAcceptCount = (weights.breakAcceptCount || 0) + 1;
      weights.lastInterventionAccepted = "break";
      if (data.triggerType.includes("walk")) weights.preferredBreakActivity = "walk";
      else if (data.triggerType.includes("stretch")) weights.preferredBreakActivity = "stretch";
      else if (data.triggerType.includes("music")) weights.preferredBreakActivity = "music";
    }
  }

  pref.learnedWeights = weights;
  pref.markModified("learnedWeights");
  await pref.save();
}

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
    } else {
      // Overnight (e.g. 22:30 to 07:00)
      return currentMins >= startMins || currentMins < endMins;
    }
  } catch {
    return false;
  }
}

/**
 * Real evaluation engine: inspects actual tasks, goals, timetables,
 * focus sessions, emotions, and wellbeing intervals to generate
 * non-duplicate contextual notifications and proactive check-in triggers.
 */
export async function evaluateProactiveContext(
  firebaseUid: string,
  userTimezone = "UTC"
): Promise<{
  newNotificationsCount: number;
  activeCheckIn: CheckInTrigger | null;
}> {
  await connectToDatabase();
  const prefsDoc = await NotificationPreferenceModel.findOne({ firebaseUid });
  const prefs = prefsDoc ? docToPreferences(prefsDoc) : await getOrCreatePreferences(firebaseUid);

  const now = new Date();

  // Check if paused
  if (prefs.pausedUntil && new Date(prefs.pausedUntil) > now) {
    return { newNotificationsCount: 0, activeCheckIn: null };
  }

  // Check quiet hours
  const inQuietHours = isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd, userTimezone);

  let newNotificationsCount = 0;
  let activeCheckIn: CheckInTrigger | null = null;

  const isCatEnabled = (cat: NotificationCategory) => prefs.categoriesEnabled[cat] !== false;

  // 1. Task Reminders: Due within next 24 hours or overdue
  if (isCatEnabled("task_reminder") && !inQuietHours) {
    const dueThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dueTasks = await TaskModel.find({
      firebaseUid,
      status: "PENDING",
      dueDate: { $ne: null, $lte: dueThreshold },
    })
      .sort({ dueDate: 1 })
      .limit(3);

    for (const task of dueTasks) {
      const recentNotif = await NotificationModel.findOne({
        firebaseUid,
        category: "task_reminder",
        "metadata.taskId": String(task._id),
        createdAt: { $gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
      });

      if (!recentNotif) {
        const isOverdue = task.dueDate && task.dueDate < now;
        await NotificationModel.create({
          firebaseUid,
          category: "task_reminder",
          title: isOverdue ? `Task Overdue: ${task.title}` : `Upcoming Task: ${task.title}`,
          body: isOverdue
            ? `This task was due earlier. Want to spend a little time making progress today?`
            : `You have "${task.title}" coming up. Want to work on it now?`,
          actionUrl: "/plan",
          actionLabel: "View Task",
          metadata: { taskId: String(task._id) },
        });
        newNotificationsCount++;

        if (!activeCheckIn && prefs.proactiveEnabled) {
          activeCheckIn = {
            id: `task_${task._id}`,
            triggerType: "task_waiting",
            message: `You have a task waiting: "${task.title}". Want to work on it together?`,
            subText: "We can break it into tiny steps so it feels lighter.",
            characterPose: "point",
            characterGaze: "center",
            actions: [
              { label: "Start Task", action: "accept", payload: "/plan", variant: "primary" },
              { label: "Talk to Nikki", action: "talk", variant: "secondary" },
              { label: "Remind Me Later", action: "snooze", variant: "ghost" },
            ],
            interventionType: "chat",
          };
        }
      }
    }
  }

  // 2. Upcoming Goals: Deadline within 48h
  if (isCatEnabled("goal_deadline") && !inQuietHours) {
    const goalThreshold = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const dueGoals = await GoalModel.find({
      firebaseUid,
      status: "ACTIVE",
      deadline: { $ne: null, $lte: goalThreshold },
    })
      .sort({ deadline: 1 })
      .limit(2);

    for (const goal of dueGoals) {
      const recentNotif = await NotificationModel.findOne({
        firebaseUid,
        category: "goal_deadline",
        "metadata.goalId": String(goal._id),
        createdAt: { $gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
      });

      if (!recentNotif) {
        await NotificationModel.create({
          firebaseUid,
          category: "goal_deadline",
          title: `Goal Deadline: ${goal.title}`,
          body: `Your milestone deadline is approaching. Keep going—you've made meaningful progress!`,
          actionUrl: "/plan",
          actionLabel: "Review Goal",
          metadata: { goalId: String(goal._id) },
        });
        newNotificationsCount++;
      }
    }
  }

  // 3. Focus Session Reminders: Active focus session > breakIntervalMinutes
  if (isCatEnabled("focus_reminder") || isCatEnabled("break_reminder")) {
    const activeSession = await FocusSessionModel.findOne({
      firebaseUid,
      status: "ACTIVE",
    });

    if (activeSession) {
      const elapsedMinutes = Math.floor((now.getTime() - activeSession.startedAt.getTime()) / (60 * 1000));
      const thresholdMinutes = prefs.breakIntervalMinutes || 45;

      if (elapsedMinutes >= thresholdMinutes) {
        const recentNotif = await NotificationModel.findOne({
          firebaseUid,
          category: "break_reminder",
          createdAt: { $gte: new Date(now.getTime() - 30 * 60 * 1000) },
        });

        if (!recentNotif) {
          await NotificationModel.create({
            firebaseUid,
            category: "break_reminder",
            title: "Focus Break Time",
            body: `You've been in deep focus for over ${elapsedMinutes} minutes. Give your eyes and mind a short 5-minute break!`,
            actionUrl: "/focus",
            actionLabel: "Take a Break",
          });
          newNotificationsCount++;

          if (!activeCheckIn && prefs.proactiveEnabled) {
            activeCheckIn = {
              id: `break_${activeSession._id}`,
              triggerType: "working_too_long",
              message: `Heyyy! You've been focusing for ${elapsedMinutes} minutes. Let's take a little breather?`,
              subText: "Your brain does its best connecting when you step away for a minute.",
              characterPose: "ponder",
              characterGaze: "center",
              actions: [
                { label: "Take a Break", action: "accept", payload: "/focus", variant: "primary" },
                { label: "Stretch a Bit", action: "accept", variant: "secondary" },
                { label: "I'm in the zone", action: "dismiss", variant: "ghost" },
              ],
              interventionType: "break",
            };
          }
        }
      }
    }
  }

  // 4. Mood-Aware Check-in: Inspect recent emotion
  if (isCatEnabled("mood_checkin") && prefs.proactiveEnabled) {
    const recentEmotion = await EmotionModel.findOne({
      firebaseUid,
      createdAt: { $gte: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
    }).sort({ createdAt: -1 });

    if (recentEmotion && recentEmotion.confidence >= 0.45) {
      const e = recentEmotion.emotion;
      const isNegativeTone = ["tired", "stressed", "anxious", "overwhelmed", "frustrated"].includes(e);
      const isPositiveTone = ["excited", "happy"].includes(e);

      if (isNegativeTone) {
        const recentNotif = await NotificationModel.findOne({
          firebaseUid,
          category: "mood_checkin",
          createdAt: { $gte: new Date(now.getTime() - 5 * 60 * 60 * 1000) },
        });

        if (!recentNotif) {
          await NotificationModel.create({
            firebaseUid,
            category: "mood_checkin",
            title: "Nikki Check-in",
            body: `Hey, things felt a bit ${e} earlier. Remember you don't have to carry everything all at once.`,
            actionUrl: "/dashboard",
            actionLabel: "Talk to Nikki",
            metadata: { emotion: e },
          });
          newNotificationsCount++;

          if (!activeCheckIn) {
            activeCheckIn = {
              id: `mood_${recentEmotion._id}`,
              triggerType: "stressed_mood",
              message: `Hey, you seemed a little ${e} earlier today. Want to talk about it?`,
              subText: "No pressure at all—I'm here whenever you need a listening ear.",
              characterPose: "ponder",
              characterGaze: "center",
              actions: [
                { label: "Talk to Nikki", action: "talk", variant: "primary" },
                { label: "I'm okay now", action: "dismiss", variant: "secondary" },
                { label: "Maybe later", action: "snooze", variant: "ghost" },
              ],
              interventionType: "chat",
            };
          }
        }
      } else if (isPositiveTone && !activeCheckIn) {
        // Occasional supportive celebratory check-in
        const recentSupport = await NotificationModel.findOne({
          firebaseUid,
          category: "nikki_supportive",
          createdAt: { $gte: new Date(now.getTime() - 8 * 60 * 60 * 1000) },
        });

        if (!recentSupport) {
          activeCheckIn = {
            id: `happy_${recentEmotion._id}`,
            triggerType: "excited_mood",
            message: `Love seeing this energy from you today! What should we conquer next?`,
            subText: "Your momentum is contagious!",
            characterPose: "celebrate",
            characterGaze: "center",
            actions: [
              { label: "Tell Nikki", action: "talk", variant: "primary" },
              { label: "Keep Going", action: "dismiss", variant: "secondary" },
            ],
            interventionType: "chat",
          };
        }
      }
    }
  }

  // 5. Late Night / Sleep Reminder
  if (isCatEnabled("sleep_reminder")) {
    let localHour = 0;
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: userTimezone || "UTC",
        hour: "numeric",
        hour12: false,
      }).formatToParts(now);
      localHour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    } catch {
      localHour = now.getUTCHours();
    }

    if (localHour >= 23 || localHour < 4) {
      const recentSleepNotif = await NotificationModel.findOne({
        firebaseUid,
        category: "sleep_reminder",
        createdAt: { $gte: new Date(now.getTime() - 8 * 60 * 60 * 1000) },
      });

      if (!recentSleepNotif) {
        await NotificationModel.create({
          firebaseUid,
          category: "sleep_reminder",
          title: "Late Night Reminder",
          body: "It's getting late. Don't forget that a good night's rest is your secret superpower.",
          actionUrl: "/dashboard",
          actionLabel: "Wind Down",
        });
        newNotificationsCount++;

        if (!activeCheckIn && prefs.proactiveEnabled) {
          activeCheckIn = {
            id: `sleep_${now.toDateString()}`,
            triggerType: "late_night",
            message: "It's getting pretty late. Don't forget to take care of yourself and rest soon.",
            subText: "Tomorrow will be waiting—you did enough today.",
            characterPose: "ponder",
            characterGaze: "center",
            actions: [
              { label: "Winding down now", action: "accept", variant: "primary" },
              { label: "Just finishing one thing", action: "snooze", variant: "secondary" },
            ],
            interventionType: "sleep",
          };
        }
      }
    }
  }

  // 6. Water & Wellbeing Reminder
  if (isCatEnabled("wellbeing_water_food") && !inQuietHours) {
    const dismisses = prefs.learnedWeights?.waterDismissCount ?? 0;
    const baseInterval = prefs.waterIntervalMinutes || 90;
    // Adapt: if user frequently dismisses water reminders, increase interval up to 2.5x so we don't annoy them
    const factor = Math.min(2.5, 1 + (dismisses * 0.2));
    const effectiveWaterIntervalMs = baseInterval * factor * 60 * 1000;

    const recentWaterNotif = await NotificationModel.findOne({
      firebaseUid,
      category: "wellbeing_water_food",
      createdAt: { $gte: new Date(now.getTime() - effectiveWaterIntervalMs) },
    });

    if (!recentWaterNotif) {
      await NotificationModel.create({
        firebaseUid,
        category: "wellbeing_water_food",
        title: "Hydration Check-in",
        body: "Have a glass of water to keep your focus sharp and your body refreshed.",
        actionUrl: "/dashboard",
        actionLabel: "I Drank Water",
      });
      newNotificationsCount++;

      if (!activeCheckIn && prefs.proactiveEnabled) {
        activeCheckIn = {
          id: `water_${now.getTime()}`,
          triggerType: "wellbeing_water",
          message: "Gentle reminder: when was the last time you took a sip of water?",
          subText: "Stay hydrated and kind to yourself today.",
          characterPose: "idle",
          characterGaze: "center",
          actions: [
            { label: "Just drank some!", action: "accept", variant: "primary" },
            { label: "Remind me later", action: "snooze", variant: "secondary" },
            { label: "Not thirsty", action: "dismiss", variant: "ghost" },
          ],
          interventionType: "water",
        };
      }
    }
  }

  return { newNotificationsCount, activeCheckIn };
}

