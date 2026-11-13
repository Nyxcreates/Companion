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
import { FocusSessionModel } from "@/models/FocusSession";
import { JournalEntryModel } from "@/models/JournalEntry";
import { MemoryModel } from "@/models/Memory";
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

export interface MissedActivityContext {
  title: string;
  start: string;
  end: string;
  minutesLate: number;
}

export interface GoalContext {
  id: string;
  title: string;
  category: string | null;
  deadline: Date | null;
  isOverdue: boolean;
  daysSinceUpdated: number;
  isStale: boolean;
  avoidCount: number;
}

export interface TaskContext {
  id: string;
  title: string;
  dueDate: Date | null;
  isOverdue: boolean;
  daysOverdue: number;
  daysSinceUpdated: number;
  isStale: boolean;
  priority?: string;
  avoidCount: number;
}

export interface NudgeContext {
  id: string;
  trigger: NikkiTrigger;
  message: string;
  status: NikkiNudgeStatus;
  idempotencyKey?: string;
  createdAt: Date;
}

export interface MoodContext {
  emotion: string;
  intensity: number;
  createdAt: Date;
}

export interface FocusSessionContext {
  status: string;
  durationMinutes: number;
  completedAt: Date | null;
  taskTitle?: string;
}

export interface JournalContext {
  title: string | null;
  mood: string | null;
  createdAt: Date;
  hoursSinceEntry: number;
}

export interface MemoryContext {
  type: string;
  content: string;
  confidence: number;
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
  checkInFrequency: "gentle" | "balanced" | "frequent";

  // Schedule & Timetable
  hasScheduleToday: boolean;
  scheduleItems: ScheduleItemContext[];
  unstartedStartedItems: UnstartedStartedItemContext[];
  missedActivities: MissedActivityContext[];
  completedActivitiesCountToday: number;
  completedTasksCountToday: number;

  // Goals & Tasks
  activeGoals: GoalContext[];
  overdueGoals: GoalContext[];
  staleGoals: GoalContext[];
  neglectedGoals: GoalContext[];
  incompleteTasks: TaskContext[];
  overdueTasks: TaskContext[];
  staleTasks: TaskContext[];
  importantUnfinishedTasks: TaskContext[];
  approachingDeadlineTasks: Array<TaskContext & { hoursUntilDue: number }>;
  avoidanceHistory: Record<string, number>;

  // Conversation & Long-Term Memory
  lastUserMessageAt: Date | null;
  minutesSinceLastUserMessage: number | null;
  lastConversationTopic: string | null;
  memories: MemoryContext[];

  // Focus Sessions
  lastFocusSession: FocusSessionContext | null;
  isFocusSessionJustFinished: boolean;
  activeFocusSession: { id: string; startedAt: Date; elapsedMinutes: number; taskTitle?: string } | null;

  // Journal Reflection
  recentJournalEntry: JournalContext | null;

  // Nudges & Interaction History
  lastNudge: NudgeContext | null;
  recentNudgeOutcomes: NikkiNudgeStatus[];
  consecutiveIgnoredOrDismissedNudges: number;
  nudgesSentTodayCount: number;

  // Moods & Wellbeing
  recentMoods: MoodContext[];
  hydrationCountToday: number;
  breakCountToday: number;

  // App Presence & Absence
  lastSeenAt: Date | null;
  minutesSinceLastSeen: number | null;
  isFirstOpenOfDay: boolean;
  isReturningAfterAbsence: boolean;
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
  const checkInFrequency = prefs?.checkInFrequency ?? "balanced";

  // Usual sleep & wake time
  const usualBedtime = user?.dailyRhythm?.sleepTime || quietHoursStart || "23:00";
  const usualWakeTime = user?.dailyRhythm?.wakeTime || quietHoursEnd || "07:30";

  // Parallel fetch of all connected user context
  const [
    scheduleDoc,
    reminders,
    goals,
    tasks,
    completedTasksTodayCount,
    lastUserMsg,
    recentNudges,
    recentEmotions,
    todayCheckIns,
    todayBreakSessionsCount,
    recentUsageSession,
    completedFocusSessions,
    activeFocusSessionDoc,
    recentJournalDoc,
    activeMemories,
  ] = await Promise.all([
    ScheduleModel.findOne({ firebaseUid, date: localDate }),
    TimetableReminderModel.find({ firebaseUid, scheduleDate: localDate }),
    GoalModel.find({ firebaseUid, status: "IN_PROGRESS" }),
    TaskModel.find({ firebaseUid, status: { $in: ["PENDING", "IN_PROGRESS"] } }),
    TaskModel.countDocuments({ firebaseUid, status: "COMPLETED", updatedAt: { $gte: startOfDayUtc } }),
    MessageModel.findOne({ firebaseUid, role: "user" }).sort({ createdAt: -1 }),
    NikkiNudgeModel.find({ firebaseUid }).sort({ createdAt: -1 }).limit(25),
    EmotionModel.find({ firebaseUid }).sort({ createdAt: -1 }).limit(5),
    CheckInHistoryModel.find({ firebaseUid, createdAt: { $gte: startOfDayUtc } }),
    BreakSessionModel.countDocuments({
      firebaseUid,
      createdAt: { $gte: startOfDayUtc },
      status: { $in: ["active", "extended", "ended"] },
    }),
    UsageSessionModel.findOne({ firebaseUid, type: "app_active" }).sort({ startedAt: -1 }),
    FocusSessionModel.find({ firebaseUid, status: "COMPLETED" }).sort({ completedAt: -1 }).limit(3),
    FocusSessionModel.findOne({ firebaseUid, status: { $in: ["ACTIVE", "PAUSED"] } }),
    JournalEntryModel.findOne({ firebaseUid }).sort({ createdAt: -1 }),
    MemoryModel.find({ firebaseUid, status: "active" }).sort({ lastUsedAt: -1, createdAt: -1 }).limit(5),
  ]);

  // Compute avoidance history per task / goal from recent nudges
  const avoidanceHistory: Record<string, number> = {};
  for (const n of recentNudges) {
    const meta = n.metadata || {};
    const targetId = (meta.targetId as string) || (meta.itemId as string);
    if (targetId) {
      avoidanceHistory[targetId] = (avoidanceHistory[targetId] || 0) + 1;
    }
  }

  // Process schedule, unstarted items & missed activities
  const reminderMap = new Map<string, string>();
  for (const r of reminders) {
    reminderMap.set(`${r.itemStart}_${r.itemTitle}`, r.status);
  }

  const scheduleItems: ScheduleItemContext[] = [];
  const unstartedStartedItems: UnstartedStartedItemContext[] = [];
  const missedActivities: MissedActivityContext[] = [];
  let completedActivitiesCountToday = 0;
  const hasScheduleToday = Boolean(scheduleDoc && scheduleDoc.items && scheduleDoc.items.length > 0);

  if (scheduleDoc?.items) {
    for (const item of scheduleDoc.items) {
      const status = reminderMap.get(`${item.start}_${item.title}`) ?? "pending";
      if (status === "done") {
        completedActivitiesCountToday++;
      }

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

        // Item started >= 10 minutes ago, but is not marked started or done
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

        // Missed activity: end time has passed by >= 15m and status is still pending/unstarted
        if (item.end) {
          const [eh, em] = item.end.split(":").map(Number);
          const itemEndMins = eh * 60 + (em || 0);
          const minutesLate = totalMinutes - itemEndMins;
          if (minutesLate >= 15 && minutesLate <= 300) {
            if (status !== "done" && status !== "skipped") {
              missedActivities.push({
                title: item.title,
                start: item.start,
                end: item.end,
                minutesLate,
              });
            }
          }
        }
      }
    }
  }

  // Process goals
  const activeGoals: GoalContext[] = [];
  const overdueGoals: GoalContext[] = [];
  const staleGoals: GoalContext[] = [];
  const neglectedGoals: GoalContext[] = [];

  for (const g of goals) {
    const updatedMs = new Date(g.updatedAt || g.createdAt).getTime();
    const daysSinceUpdated = Math.floor((now.getTime() - updatedMs) / (1000 * 60 * 60 * 24));
    const isStale = daysSinceUpdated >= 3;
    const isOverdue = Boolean(g.deadline && new Date(g.deadline) < now);
    const goalId = String(g._id);
    const avoidCount = avoidanceHistory[goalId] || 0;

    const goalCtx: GoalContext = {
      id: goalId,
      title: g.title,
      category: g.category ?? null,
      deadline: g.deadline ? new Date(g.deadline) : null,
      isOverdue,
      daysSinceUpdated,
      isStale,
      avoidCount,
    };
    activeGoals.push(goalCtx);
    if (isOverdue) overdueGoals.push(goalCtx);
    if (isStale) {
      staleGoals.push(goalCtx);
      neglectedGoals.push(goalCtx);
    }
  }

  // Process tasks
  const incompleteTasks: TaskContext[] = [];
  const overdueTasks: TaskContext[] = [];
  const staleTasks: TaskContext[] = [];
  const importantUnfinishedTasks: TaskContext[] = [];
  const approachingDeadlineTasks: Array<TaskContext & { hoursUntilDue: number }> = [];

  for (const t of tasks) {
    const updatedMs = new Date(t.updatedAt || t.createdAt).getTime();
    const daysSinceUpdated = Math.floor((now.getTime() - updatedMs) / (1000 * 60 * 60 * 24));
    const isStale = daysSinceUpdated >= 3;
    const isOverdue = Boolean(t.dueDate && new Date(t.dueDate) < now);
    const daysOverdue = isOverdue && t.dueDate
      ? Math.max(1, Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const taskId = String(t._id);
    const avoidCount = avoidanceHistory[taskId] || 0;
    const priority = (t as unknown as { priority?: string })?.priority || "medium";

    const taskCtx: TaskContext = {
      id: taskId,
      title: t.title,
      dueDate: t.dueDate ? new Date(t.dueDate) : null,
      isOverdue,
      daysOverdue,
      daysSinceUpdated,
      isStale,
      priority,
      avoidCount,
    };
    incompleteTasks.push(taskCtx);
    if (isOverdue) overdueTasks.push(taskCtx);
    if (isStale) staleTasks.push(taskCtx);

    // Important unfinished tasks (high priority or due today)
    if (priority === "high" || priority === "urgent") {
      importantUnfinishedTasks.push(taskCtx);
    }

    // Approaching deadline tasks (due within next 6 hours or today)
    if (t.dueDate && !isOverdue) {
      const hoursUntilDue = (new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDue >= 0 && hoursUntilDue <= 6) {
        approachingDeadlineTasks.push({
          ...taskCtx,
          hoursUntilDue: Math.round(hoursUntilDue * 10) / 10,
        });
      }
    }
  }

  // Focus sessions
  const latestCompletedFocus = completedFocusSessions[0] || null;
  let lastFocusSession: FocusSessionContext | null = null;
  let isFocusSessionJustFinished = false;

  if (latestCompletedFocus?.completedAt) {
    const minsSinceFocus = Math.floor(
      (now.getTime() - new Date(latestCompletedFocus.completedAt).getTime()) / 60000
    );
    const durationMinutes = Math.round(
      (latestCompletedFocus.actualDurationSeconds || latestCompletedFocus.plannedDurationSeconds || 0) / 60
    );

    lastFocusSession = {
      status: "COMPLETED",
      durationMinutes,
      completedAt: new Date(latestCompletedFocus.completedAt),
    };

    if (minsSinceFocus >= 0 && minsSinceFocus <= 15 && durationMinutes >= 20) {
      isFocusSessionJustFinished = true;
    }
  }

  let activeFocusSession: { id: string; startedAt: Date; elapsedMinutes: number; taskTitle?: string } | null = null;
  if (activeFocusSessionDoc) {
    const elapsedMinutes = Math.floor((now.getTime() - new Date(activeFocusSessionDoc.startedAt).getTime()) / 60000);
    activeFocusSession = {
      id: String(activeFocusSessionDoc._id),
      startedAt: new Date(activeFocusSessionDoc.startedAt),
      elapsedMinutes,
    };
  }

  // Journal entry
  let recentJournalEntry: JournalContext | null = null;
  if (recentJournalDoc) {
    const hoursSinceEntry = Math.floor((now.getTime() - new Date(recentJournalDoc.createdAt).getTime()) / (1000 * 60 * 60));
    recentJournalEntry = {
      title: recentJournalDoc.title,
      mood: recentJournalDoc.mood || null,
      createdAt: new Date(recentJournalDoc.createdAt),
      hoursSinceEntry,
    };
  }

  // Long-Term Memory
  const memories: MemoryContext[] = activeMemories.map((m) => ({
    type: m.type,
    content: m.content,
    confidence: m.confidence,
  }));

  // Conversation history
  const lastUserMessageAt = lastUserMsg?.createdAt ? new Date(lastUserMsg.createdAt) : null;
  const minutesSinceLastUserMessage = lastUserMessageAt
    ? Math.floor((now.getTime() - lastUserMessageAt.getTime()) / 60000)
    : null;
  const lastConversationTopic = lastUserMsg?.content ? lastUserMsg.content.slice(0, 100) : null;

  // Process nudges & outcomes
  const lastNudgeDoc = recentNudges[0] ?? null;
  const lastNudge: NudgeContext | null = lastNudgeDoc
    ? {
        id: String(lastNudgeDoc._id),
        trigger: lastNudgeDoc.trigger,
        message: lastNudgeDoc.message,
        status: lastNudgeDoc.status,
        idempotencyKey: lastNudgeDoc.idempotencyKey,
        createdAt: new Date(lastNudgeDoc.createdAt),
      }
    : null;

  const recentNudgeOutcomes: NikkiNudgeStatus[] = recentNudges.map((n) => n.status);

  // Consecutive ignored or dismissed nudges:
  let consecutiveIgnoredOrDismissedNudges = 0;
  for (const n of recentNudges) {
    const nudgeTime = new Date(n.createdAt).getTime();
    if (lastUserMessageAt && lastUserMessageAt.getTime() > nudgeTime) {
      break; // user spoke to Nikki after this nudge
    }
    if (n.status === "dismissed" || n.status === "expired") {
      consecutiveIgnoredOrDismissedNudges++;
    } else if (n.status === "delivered" || n.status === "created") {
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

  // App presence & absence
  const lastSeenAt = prefs?.lastSeenAt
    ? new Date(prefs.lastSeenAt)
    : recentUsageSession?.endedAt
      ? new Date(recentUsageSession.endedAt)
      : null;

  const minutesSinceLastSeen = lastSeenAt
    ? Math.max(0, Math.floor((now.getTime() - lastSeenAt.getTime()) / 60000))
    : null;

  // First open of day: user active now, but lastSeen was before wake time or yesterday
  const [wakeH, wakeM] = (usualWakeTime || "07:30").split(":").map(Number);
  const wakeMins = (wakeH || 7) * 60 + (wakeM || 30);
  const isFirstOpenOfDay = Boolean(
    totalMinutes >= wakeMins &&
    minutesSinceLastSeen !== null &&
    minutesSinceLastSeen >= 6 * 60 &&
    currentHour < 12
  );

  // Return after absence: user away for >= 4 hours during active hours (10:00 - 21:00), now back
  const isReturningAfterAbsence = Boolean(
    minutesSinceLastSeen !== null &&
    minutesSinceLastSeen >= 4 * 60 &&
    currentHour >= 11 &&
    currentHour <= 21 &&
    !isFirstOpenOfDay
  );

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
    checkInFrequency,

    hasScheduleToday,
    scheduleItems,
    unstartedStartedItems,
    missedActivities,
    completedActivitiesCountToday,
    completedTasksCountToday: completedTasksTodayCount,

    activeGoals,
    overdueGoals,
    staleGoals,
    neglectedGoals,
    incompleteTasks,
    overdueTasks,
    staleTasks,
    importantUnfinishedTasks,
    approachingDeadlineTasks,
    avoidanceHistory,

    lastUserMessageAt,
    minutesSinceLastUserMessage,
    lastConversationTopic,
    memories,

    lastFocusSession,
    isFocusSessionJustFinished,
    activeFocusSession,

    recentJournalEntry,

    lastNudge,
    recentNudgeOutcomes,
    consecutiveIgnoredOrDismissedNudges,
    nudgesSentTodayCount,

    recentMoods,
    hydrationCountToday,
    breakCountToday,

    lastSeenAt,
    minutesSinceLastSeen,
    isFirstOpenOfDay,
    isReturningAfterAbsence,
    isLongContinuousSession,
    usualBedtime,
    usualWakeTime,
  };
}
