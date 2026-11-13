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
import { computeProgressPercent } from "@/lib/goals/progress";
import { detectAllGoalTaskInsights, type GoalTaskDetectionResult } from "./goalTaskDetection";

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
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  deadline: Date | null;
  isOverdue: boolean;
  daysUntilDeadline: number | null;
  daysSinceUpdated: number;
  isStale: boolean;
  avoidCount: number;
  targetLabel: string | null;
  targetValue: number | null;
  progressValue: number | null;
  progressPercent: number | null;
  completedAt: Date | null;
  hasGoodProgress: boolean;
}

export interface TaskContext {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  dueDate: Date | null;
  goalId?: string | null;
  goalTitle?: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  daysSinceUpdated: number;
  isStale: boolean;
  priority?: string;
  avoidCount: number;
  postponeCount?: number;
  isPostponed?: boolean;
  completedAt?: Date | null;
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

  // Goals & Tasks Awareness (Part 4A)
  activeGoals: GoalContext[];
  completedGoals: GoalContext[];
  allGoals: GoalContext[];
  overdueGoals: GoalContext[];
  staleGoals: GoalContext[];
  neglectedGoals: GoalContext[];
  highPriorityNeglectedGoals: GoalContext[];
  goalsMakingGoodProgress: GoalContext[];

  pendingTasks: TaskContext[];
  completedTasks: TaskContext[];
  incompleteTasks: TaskContext[];
  overdueTasks: TaskContext[];
  staleTasks: TaskContext[];
  postponedTasks: TaskContext[];
  repeatedlyPostponedTasks: TaskContext[];
  importantUnfinishedTasks: TaskContext[];
  approachingDeadlineTasks: Array<TaskContext & { hoursUntilDue: number }>;
  avoidanceHistory: Record<string, number>;
  /** Total pending+in_progress tasks today (for overload detection) */
  totalPendingTasksCount: number;

  // Lightweight detection insights (Part 4B)
  goalTaskDetections?: GoalTaskDetectionResult;

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
    allGoalDocs,
    pendingTaskDocs,
    recentCompletedTaskDocs,
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
    GoalModel.find({ firebaseUid }),
    TaskModel.find({ firebaseUid, status: { $in: ["PENDING", "IN_PROGRESS"] } }).sort({ dueDate: 1, createdAt: -1 }),
    TaskModel.find({ firebaseUid, status: "COMPLETED" }).sort({ completedAt: -1, updatedAt: -1 }).limit(20),
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

  // Build goal title lookup map (0 extra database queries)
  const goalTitleMap = new Map<string, string>();
  for (const g of allGoalDocs) {
    goalTitleMap.set(String(g._id), g.title);
  }

  // Detect timetable reminders marked "later" or dismissed today
  const postponedReminderTitles = new Set(
    reminders
      .filter((r) => r.status === "later" || r.userDismissedCount > 0)
      .map((r) => (r.itemTitle || "").trim().toLowerCase())
  );

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

  // Process goals (Part 4A: all statuses, progress, deadlines)
  const allGoals: GoalContext[] = [];
  const activeGoals: GoalContext[] = [];
  const completedGoals: GoalContext[] = [];
  const overdueGoals: GoalContext[] = [];
  const staleGoals: GoalContext[] = [];
  const neglectedGoals: GoalContext[] = [];
  const highPriorityNeglectedGoals: GoalContext[] = [];
  const goalsMakingGoodProgress: GoalContext[] = [];

  for (const g of allGoalDocs) {
    const updatedMs = new Date(g.updatedAt || g.createdAt).getTime();
    const daysSinceUpdated = !isNaN(updatedMs)
      ? Math.max(0, Math.floor((now.getTime() - updatedMs) / (1000 * 60 * 60 * 24)))
      : 0;

    const deadlineDate = g.deadline && !isNaN(new Date(g.deadline).getTime()) ? new Date(g.deadline) : null;
    const isOverdue = Boolean(deadlineDate && deadlineDate.getTime() < now.getTime() && g.status !== "COMPLETED");
    const daysUntilDeadline = deadlineDate
      ? Math.round((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const goalId = String(g._id);
    const avoidCount = avoidanceHistory[goalId] || 0;

    const targetVal = typeof g.targetValue === "number" && g.targetValue > 0 ? g.targetValue : null;
    const progressVal = typeof g.progressValue === "number" ? g.progressValue : null;
    const progressPercent = computeProgressPercent(targetVal, progressVal);

    // Stale check: HIGH priority stale after 2 days; others after 3 days
    const staleThreshold = g.priority === "HIGH" ? 2 : 3;
    const isStale = daysSinceUpdated >= staleThreshold && g.status === "ACTIVE";

    const completedAtDate = g.completedAt && !isNaN(new Date(g.completedAt).getTime())
      ? new Date(g.completedAt)
      : null;

    const hasGoodProgress = Boolean(
      g.status === "COMPLETED" ||
      (progressPercent !== null && progressPercent >= 50) ||
      (progressPercent !== null && progressPercent > 0 && daysSinceUpdated <= 1)
    );

    const goalCtx: GoalContext = {
      id: goalId,
      title: g.title || "Untitled Goal",
      description: g.description ?? null,
      category: g.category ?? null,
      priority: g.priority ?? "MEDIUM",
      status: g.status ?? "ACTIVE",
      deadline: deadlineDate,
      isOverdue,
      daysUntilDeadline,
      daysSinceUpdated,
      isStale,
      avoidCount,
      targetLabel: g.targetLabel ?? null,
      targetValue: targetVal,
      progressValue: progressVal,
      progressPercent,
      completedAt: completedAtDate,
      hasGoodProgress,
    };

    allGoals.push(goalCtx);

    if (g.status === "COMPLETED") {
      completedGoals.push(goalCtx);
      if (hasGoodProgress) goalsMakingGoodProgress.push(goalCtx);
    } else if (g.status === "ACTIVE") {
      activeGoals.push(goalCtx);
      if (isOverdue) overdueGoals.push(goalCtx);
      if (isStale) {
        staleGoals.push(goalCtx);
        neglectedGoals.push(goalCtx);
        if (g.priority === "HIGH") {
          highPriorityNeglectedGoals.push(goalCtx);
        }
      }
      if (hasGoodProgress) {
        goalsMakingGoodProgress.push(goalCtx);
      }
    }
  }

  // Process tasks (Part 4A: pending, completed, overdue, deadlines, postponed)
  const pendingTasks: TaskContext[] = [];
  const incompleteTasks: TaskContext[] = [];
  const completedTasks: TaskContext[] = [];
  const overdueTasks: TaskContext[] = [];
  const staleTasks: TaskContext[] = [];
  const postponedTasks: TaskContext[] = [];
  const repeatedlyPostponedTasks: TaskContext[] = [];
  const importantUnfinishedTasks: TaskContext[] = [];
  const approachingDeadlineTasks: Array<TaskContext & { hoursUntilDue: number }> = [];

  for (const t of pendingTaskDocs) {
    const updatedMs = new Date(t.updatedAt || t.createdAt).getTime();
    const daysSinceUpdated = !isNaN(updatedMs)
      ? Math.max(0, Math.floor((now.getTime() - updatedMs) / (1000 * 60 * 60 * 24)))
      : 0;
    const isStale = daysSinceUpdated >= 3;

    const dueDate = t.dueDate && !isNaN(new Date(t.dueDate).getTime()) ? new Date(t.dueDate) : null;
    const isOverdue = Boolean(dueDate && dueDate.getTime() < now.getTime());
    const daysOverdue = isOverdue && dueDate
      ? Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const taskId = String(t._id);
    const avoidCount = avoidanceHistory[taskId] || 0;
    const titleLower = (t.title || "").trim().toLowerCase();
    const reminderPostponedCount = postponedReminderTitles.has(titleLower) ? 1 : 0;
    const postponeCount = avoidCount + reminderPostponedCount;
    const isPostponed = postponeCount > 0;

    const priority = (t as unknown as { priority?: string })?.priority || "medium";
    const goalId = t.goalId ? String(t.goalId) : null;
    const goalTitle = goalId ? (goalTitleMap.get(goalId) ?? null) : null;

    const taskCtx: TaskContext = {
      id: taskId,
      title: t.title || "Untitled Task",
      description: t.description ?? null,
      status: t.status ?? "PENDING",
      dueDate,
      goalId,
      goalTitle,
      isOverdue,
      daysOverdue,
      daysSinceUpdated,
      isStale,
      priority,
      avoidCount,
      postponeCount,
      isPostponed,
      completedAt: null,
    };

    pendingTasks.push(taskCtx);
    incompleteTasks.push(taskCtx);

    if (isOverdue) overdueTasks.push(taskCtx);
    if (isStale) staleTasks.push(taskCtx);
    if (isPostponed) postponedTasks.push(taskCtx);
    if (postponeCount >= 2 || avoidCount >= 2) repeatedlyPostponedTasks.push(taskCtx);

    // Important unfinished tasks (high priority or urgent)
    if (priority === "high" || priority === "urgent") {
      importantUnfinishedTasks.push(taskCtx);
    }

    // Approaching deadline tasks (due in future within next 24 hours)
    if (dueDate && !isOverdue) {
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDue >= 0 && hoursUntilDue <= 24) {
        approachingDeadlineTasks.push({
          ...taskCtx,
          hoursUntilDue: Math.round(hoursUntilDue * 10) / 10,
        });
      }
    }
  }

  // Process completed tasks
  for (const t of recentCompletedTaskDocs) {
    const updatedMs = new Date(t.updatedAt || t.createdAt).getTime();
    const daysSinceUpdated = !isNaN(updatedMs)
      ? Math.max(0, Math.floor((now.getTime() - updatedMs) / (1000 * 60 * 60 * 24)))
      : 0;
    const dueDate = t.dueDate && !isNaN(new Date(t.dueDate).getTime()) ? new Date(t.dueDate) : null;
    const goalId = t.goalId ? String(t.goalId) : null;
    const goalTitle = goalId ? (goalTitleMap.get(goalId) ?? null) : null;
    const completedAt = t.completedAt && !isNaN(new Date(t.completedAt).getTime())
      ? new Date(t.completedAt)
      : null;

    completedTasks.push({
      id: String(t._id),
      title: t.title || "Untitled Task",
      description: t.description ?? null,
      status: "COMPLETED",
      dueDate,
      goalId,
      goalTitle,
      isOverdue: false, // completed tasks are NEVER overdue
      daysOverdue: 0,
      daysSinceUpdated,
      isStale: false,
      priority: (t as unknown as { priority?: string })?.priority || "medium",
      avoidCount: 0,
      postponeCount: 0,
      isPostponed: false,
      completedAt,
    });
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

  const snapshot: NikkiContextSnapshot = {
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

    // Goals & Tasks Awareness (Part 4A)
    activeGoals,
    completedGoals,
    allGoals,
    overdueGoals,
    staleGoals,
    neglectedGoals,
    highPriorityNeglectedGoals,
    goalsMakingGoodProgress,

    pendingTasks,
    completedTasks,
    incompleteTasks,
    overdueTasks,
    staleTasks,
    postponedTasks,
    repeatedlyPostponedTasks,
    importantUnfinishedTasks,
    approachingDeadlineTasks,
    avoidanceHistory,
    totalPendingTasksCount: pendingTasks.length,

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

  snapshot.goalTaskDetections = detectAllGoalTaskInsights(snapshot, { now });
  return snapshot;
}
