import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";
import { ScheduleModel } from "@/models/Schedule";
import { TimetableReminderModel } from "@/models/TimetableReminder";
import { GoalModel } from "@/models/Goal";
import { TaskModel } from "@/models/Task";
import { MessageModel } from "@/models/Message";
import { NikkiNudgeModel, type NikkiNudgeStatus, type NikkiTrigger } from "@/models/NikkiNudge";
import { EmotionModel } from "@/models/Emotion";
import { CheckInHistoryModel } from "@/models/CheckInHistory";
import { BreakSessionModel } from "@/models/BreakSession";
import { UsageSessionModel } from "@/models/UsageSession";
import { resolveUserTimezone, parseDateTimeInTimezone } from "@/lib/time/currentTime";
import type { NikkiStrictness } from "@/types/notification";

export interface ScheduleItemContext {
  title: string;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  type: string;
  status: string; // "started" | "pending" | "done" | "skipped" | "later" | "dismissed"
}

export interface UnstartedStartedItemContext {
  title: string;
  start: string;
  end: string;
  minutesSinceStart: number;
}

export interface GoalContext {
  id: string;
  title: string;
  category: string | null;
  deadline: Date | null;
  isOverdue: boolean;
  daysSinceUpdated: number;
  isStale: boolean;
}

export interface TaskContext {
  id: string;
  title: string;
  dueDate: Date | null;
  isOverdue: boolean;
  daysOverdue: number;
  daysSinceUpdated: number;
  isStale: boolean;
}

export interface NudgeContext {
  id: string;
  trigger: NikkiTrigger;
  message: string;
  status: NikkiNudgeStatus;
  createdAt: Date;
}

export interface MoodContext {
  emotion: string;
  intensity: number;
  createdAt: Date;
}

export interface NikkiContextSnapshot {
  firebaseUid: string;
  userName: string;
  companionName: string;
  timezone: string;
  localTime: string; // "HH:MM"
  localDate: string; // "YYYY-MM-DD"
  currentHour: number;
  currentMinute: number;
  totalMinutes: number;

  // Preferences & Boundaries
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  isQuietHours: boolean;
  isPaused: boolean;
  pausedUntil: Date | null;
  proactiveEnabled: boolean;
  strictness: NikkiStrictness;

  // Schedule & Timetable
  hasScheduleToday: boolean;
  scheduleItems: ScheduleItemContext[];
  unstartedStartedItems: UnstartedStartedItemContext[];

  // Goals & Tasks
  activeGoals: GoalContext[];
  overdueGoals: GoalContext[];
  staleGoals: GoalContext[];
  incompleteTasks: TaskContext[];
  overdueTasks: TaskContext[];
  staleTasks: TaskContext[];

  // Conversation & Nudges
  lastUserMessageAt: Date | null;
  minutesSinceLastUserMessage: number | null;
  lastNudge: NudgeContext | null;
  recentNudgeOutcomes: NikkiNudgeStatus[];
  consecutiveIgnoredOrDismissedNudges: number;
  nudgesSentTodayCount: number;

  // Moods & Wellbeing
  recentMoods: MoodContext[];
  hydrationCountToday: number;
  breakCountToday: number;

  // App presence
  lastSeenAt: Date | null;
  minutesSinceLastSeen: number | null;
  isLongContinuousSession: boolean;
  usualBedtime: string; // "HH:MM"
  usualWakeTime: string; // "HH:MM"
}

export function isQuietHoursCheck(
  start: string | null,
  end: string | null,
  hour: number,
  minute: number
): boolean {
  if (!start || !end) return false;
  const currentMins = hour * 60 + minute;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMins = startH * 60 + (startM || 0);
  const endMins = endH * 60 + (endM || 0);

  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  }
  return currentMins >= startMins || currentMins < endMins;
}

export async function buildNikkiContext(
  firebaseUid: string,
  now: Date = new Date()
): Promise<NikkiContextSnapshot> {
  await connectToDatabase();

  const [user, prefs] = await Promise.all([
    UserModel.findOne({ firebaseUid }),
    NotificationPreferenceModel.findOne({ firebaseUid }),
  ]);

  const timezone = resolveUserTimezone(null, user?.timezone);
  const userName = user?.displayName?.trim() || "friend";
  const companionName = user?.companionName?.trim() || "Nikki";

  // Compute local time & date in user's timezone
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const partMap: Record<string, string> = {};
  for (const p of parts) partMap[p.type] = p.value;

  const currentHour = parseInt(partMap.hour ?? "0", 10);
  const currentMinute = parseInt(partMap.minute ?? "0", 10);
  const totalMinutes = currentHour * 60 + currentMinute;
  const localTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
  const localDate = `${partMap.year}-${partMap.month}-${partMap.day}`;

  // Start of today in user's timezone as UTC Date
  const startOfDayUtc = parseDateTimeInTimezone(localDate, "00:00", timezone);

  // Quiet hours & pause
  const quietHoursStart = prefs?.quietHoursStart ?? "22:30";
  const quietHoursEnd = prefs?.quietHoursEnd ?? "07:00";
  const isQuietHours = isQuietHoursCheck(quietHoursStart, quietHoursEnd, currentHour, currentMinute);
  const isPaused = Boolean(prefs?.pausedUntil && new Date(prefs.pausedUntil) > now);
  const proactiveEnabled = prefs?.proactiveEnabled !== false;
  const strictness: NikkiStrictness = prefs?.strictness ?? "playful";

  // Usual sleep & wake time
  const usualBedtime = user?.dailyRhythm?.sleepTime || quietHoursStart || "23:00";
  const usualWakeTime = user?.dailyRhythm?.wakeTime || quietHoursEnd || "07:30";

  // Parallel fetch of rest of data
  const [
    scheduleDoc,
    reminders,
    goals,
    tasks,
    lastUserMsg,
    recentNudges,
    recentEmotions,
    todayCheckIns,
    todayBreakSessionsCount,
    recentUsageSession,
  ] = await Promise.all([
    ScheduleModel.findOne({ firebaseUid, date: localDate }),
    TimetableReminderModel.find({ firebaseUid, scheduleDate: localDate }),
    GoalModel.find({ firebaseUid, status: "IN_PROGRESS" }),
    TaskModel.find({ firebaseUid, status: { $in: ["PENDING", "IN_PROGRESS"] } }),
    MessageModel.findOne({ firebaseUid, role: "user" }).sort({ createdAt: -1 }),
    NikkiNudgeModel.find({ firebaseUid }).sort({ createdAt: -1 }).limit(10),
    EmotionModel.find({ firebaseUid }).sort({ createdAt: -1 }).limit(5),
    CheckInHistoryModel.find({ firebaseUid, createdAt: { $gte: startOfDayUtc } }),
    BreakSessionModel.countDocuments({
      firebaseUid,
      createdAt: { $gte: startOfDayUtc },
      status: { $in: ["active", "extended", "ended"] },
    }),
    UsageSessionModel.findOne({ firebaseUid, type: "app_active" }).sort({ startedAt: -1 }),
  ]);

  // Process schedule & unstarted items
  const reminderMap = new Map<string, string>();
  for (const r of reminders) {
    reminderMap.set(`${r.itemStart}_${r.itemTitle}`, r.status);
  }

  const scheduleItems: ScheduleItemContext[] = [];
  const unstartedStartedItems: UnstartedStartedItemContext[] = [];
  const hasScheduleToday = Boolean(scheduleDoc && scheduleDoc.items && scheduleDoc.items.length > 0);

  if (scheduleDoc?.items) {
    for (const item of scheduleDoc.items) {
      const status = reminderMap.get(`${item.start}_${item.title}`) ?? "pending";
      scheduleItems.push({
        title: item.title,
        start: item.start,
        end: item.end,
        type: item.type,
        status,
      });

      if (item.type !== "break" && item.type !== "free" && item.start) {
        const [ih, im] = item.start.split(":").map(Number);
        const itemStartMins = ih * 60 + (im || 0);
        const minutesSinceStart = totalMinutes - itemStartMins;

        // Item has started >= 10 minutes ago, but is not marked started or done
        if (minutesSinceStart >= 10 && minutesSinceStart <= 120) {
          if (status !== "started" && status !== "done" && status !== "skipped") {
            unstartedStartedItems.push({
              title: item.title,
              start: item.start,
              end: item.end,
              minutesSinceStart,
            });
          }
        }
      }
    }
  }

  // Process goals
  const activeGoals: GoalContext[] = [];
  const overdueGoals: GoalContext[] = [];
  const staleGoals: GoalContext[] = [];

  for (const g of goals) {
    const updatedMs = new Date(g.updatedAt || g.createdAt).getTime();
    const daysSinceUpdated = Math.floor((now.getTime() - updatedMs) / (1000 * 60 * 60 * 24));
    const isStale = daysSinceUpdated >= 3;
    const isOverdue = Boolean(g.deadline && new Date(g.deadline) < now);

    const goalCtx: GoalContext = {
      id: String(g._id),
      title: g.title,
      category: g.category ?? null,
      deadline: g.deadline ? new Date(g.deadline) : null,
      isOverdue,
      daysSinceUpdated,
      isStale,
    };
    activeGoals.push(goalCtx);
    if (isOverdue) overdueGoals.push(goalCtx);
    if (isStale) staleGoals.push(goalCtx);
  }

  // Process tasks
  const incompleteTasks: TaskContext[] = [];
  const overdueTasks: TaskContext[] = [];
  const staleTasks: TaskContext[] = [];

  for (const t of tasks) {
    const updatedMs = new Date(t.updatedAt || t.createdAt).getTime();
    const daysSinceUpdated = Math.floor((now.getTime() - updatedMs) / (1000 * 60 * 60 * 24));
    const isStale = daysSinceUpdated >= 3;
    const isOverdue = Boolean(t.dueDate && new Date(t.dueDate) < now);
    const daysOverdue = isOverdue && t.dueDate
      ? Math.max(1, Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const taskCtx: TaskContext = {
      id: String(t._id),
      title: t.title,
      dueDate: t.dueDate ? new Date(t.dueDate) : null,
      isOverdue,
      daysOverdue,
      daysSinceUpdated,
      isStale,
    };
    incompleteTasks.push(taskCtx);
    if (isOverdue) overdueTasks.push(taskCtx);
    if (isStale) staleTasks.push(taskCtx);
  }

  // Last time user talked to Nikki
  const lastUserMessageAt = lastUserMsg?.createdAt ? new Date(lastUserMsg.createdAt) : null;
  const minutesSinceLastUserMessage = lastUserMessageAt
    ? Math.floor((now.getTime() - lastUserMessageAt.getTime()) / 60000)
    : null;

  // Process nudges & outcomes
  const lastNudgeDoc = recentNudges[0] ?? null;
  const lastNudge: NudgeContext | null = lastNudgeDoc
    ? {
        id: String(lastNudgeDoc._id),
        trigger: lastNudgeDoc.trigger,
        message: lastNudgeDoc.message,
        status: lastNudgeDoc.status,
        createdAt: new Date(lastNudgeDoc.createdAt),
      }
    : null;

  const recentNudgeOutcomes: NikkiNudgeStatus[] = recentNudges.map((n) => n.status);

  // Consecutive ignored or dismissed nudges:
  // If the user interacted (sent a message) after the nudge was sent, that breaks consecutive ignored.
  let consecutiveIgnoredOrDismissedNudges = 0;
  for (const n of recentNudges) {
    const nudgeTime = new Date(n.createdAt).getTime();
    if (lastUserMessageAt && lastUserMessageAt.getTime() > nudgeTime) {
      break; // user spoke to Nikki after this nudge
    }
    if (n.status === "dismissed" || n.status === "expired") {
      consecutiveIgnoredOrDismissedNudges++;
    } else if (n.status === "delivered" || n.status === "created") {
      // If delivered more than 3 hours ago with no reply, treat as ignored
      const ageHours = (now.getTime() - nudgeTime) / (1000 * 60 * 60);
      if (ageHours >= 3) {
        consecutiveIgnoredOrDismissedNudges++;
      }
    } else if (n.status === "replied") {
      break;
    }
  }

  const nudgesSentTodayCount = recentNudges.filter(
    (n) => new Date(n.createdAt).getTime() >= startOfDayUtc.getTime()
  ).length;

  // Moods
  const recentMoods: MoodContext[] = recentEmotions.map((e) => ({
    emotion: e.emotion,
    intensity: e.intensity,
    createdAt: new Date(e.createdAt),
  }));

  // Wellbeing counts today
  let hydrationCountToday = 0;
  let breakCountToday = todayBreakSessionsCount;

  for (const c of todayCheckIns) {
    if (
      (c.interventionType === "water" || c.triggerType?.includes("water")) &&
      c.action === "accept"
    ) {
      hydrationCountToday++;
    }
    if (
      (c.interventionType === "break" || c.triggerType?.includes("break")) &&
      c.action === "accept"
    ) {
      breakCountToday++;
    }
  }

  // App presence
  const lastSeenAt = prefs?.lastSeenAt
    ? new Date(prefs.lastSeenAt)
    : recentUsageSession?.endedAt
      ? new Date(recentUsageSession.endedAt)
      : null;

  const minutesSinceLastSeen = lastSeenAt
    ? Math.max(0, Math.floor((now.getTime() - lastSeenAt.getTime()) / 60000))
    : null;

  // Long continuous session check
  const isRecentSession = Boolean(
    recentUsageSession &&
    now.getTime() - new Date(recentUsageSession.endedAt).getTime() <= 15 * 60 * 1000 &&
    recentUsageSession.durationSeconds >= 45 * 60
  );
  const isLongContinuousSession = isRecentSession;

  return {
    firebaseUid,
    userName,
    companionName,
    timezone,
    localTime,
    localDate,
    currentHour,
    currentMinute,
    totalMinutes,

    quietHoursStart,
    quietHoursEnd,
    isQuietHours,
    isPaused,
    pausedUntil: prefs?.pausedUntil ? new Date(prefs.pausedUntil) : null,
    proactiveEnabled,
    strictness,

    hasScheduleToday,
    scheduleItems,
    unstartedStartedItems,

    activeGoals,
    overdueGoals,
    staleGoals,
    incompleteTasks,
    overdueTasks,
    staleTasks,

    lastUserMessageAt,
    minutesSinceLastUserMessage,
    lastNudge,
    recentNudgeOutcomes,
    consecutiveIgnoredOrDismissedNudges,
    nudgesSentTodayCount,

    recentMoods,
    hydrationCountToday,
    breakCountToday,

    lastSeenAt,
    minutesSinceLastSeen,
    isLongContinuousSession,
    usualBedtime,
    usualWakeTime,
  };
}

