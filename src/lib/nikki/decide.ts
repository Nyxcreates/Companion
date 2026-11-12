import type { NikkiContextSnapshot } from "./context";
import type { NikkiTrigger } from "@/models/NikkiNudge";

export interface NikkiDecision {
  shouldSpeak: boolean;
  trigger?: NikkiTrigger;
  idempotencyKey?: string;
  reason: string;
  triggerContext?: Record<string, unknown>;
}

export interface DecideOptions {
  maxDailyNudges?: number;
  minGapMinutes?: number;
  backoffThreshold?: number;
}

const DEFAULT_MAX_DAILY_NUDGES = 3;
const DEFAULT_MIN_GAP_MINUTES = 90;
const DEFAULT_BACKOFF_THRESHOLD = 3;

/**
 * Pure rule-based decision engine: decides IF Nikki should initiate conversation.
 * Cheap pre-check with zero AI or external network calls.
 */
export function decideNikkiNudge(
  context: NikkiContextSnapshot,
  options: DecideOptions = {}
): NikkiDecision {
  const maxDailyNudges = options.maxDailyNudges ?? DEFAULT_MAX_DAILY_NUDGES;
  const minGapMinutes = options.minGapMinutes ?? DEFAULT_MIN_GAP_MINUTES;
  const backoffThreshold = options.backoffThreshold ?? DEFAULT_BACKOFF_THRESHOLD;

  // ── Guard 1: Proactive toggle ──────────────────────────────────────────────
  if (!context.proactiveEnabled) {
    return {
      shouldSpeak: false,
      reason: "Proactive communication is disabled in user preferences.",
    };
  }

  // ── Guard 2: Pause check ───────────────────────────────────────────────────
  if (context.isPaused) {
    return {
      shouldSpeak: false,
      reason: "User notifications are currently paused.",
    };
  }

  // ── Guard 3: Quiet hours ───────────────────────────────────────────────────
  if (context.isQuietHours) {
    return {
      shouldSpeak: false,
      reason: `Quiet hours active (${context.quietHoursStart ?? "22:30"} - ${context.quietHoursEnd ?? "07:00"}).`,
    };
  }

  // ── Guard 4: Back-off after ignored / dismissed nudges ─────────────────────
  if (context.consecutiveIgnoredOrDismissedNudges >= backoffThreshold) {
    return {
      shouldSpeak: false,
      reason: `Backing off after ${context.consecutiveIgnoredOrDismissedNudges} ignored or dismissed nudges.`,
    };
  }

  // ── Guard 5: Max unprompted messages per day ───────────────────────────────
  if (context.nudgesSentTodayCount >= maxDailyNudges) {
    return {
      shouldSpeak: false,
      reason: `Daily limit of ${maxDailyNudges} unprompted messages reached (${context.nudgesSentTodayCount} sent today).`,
    };
  }

  // ── Guard 6: Minimum gap between messages ──────────────────────────────────
  if (context.lastNudge) {
    const nowMs = Date.now();
    const lastNudgeMs = new Date(context.lastNudge.createdAt).getTime();
    const minutesSinceLastNudge = Math.floor((nowMs - lastNudgeMs) / 60000);

    if (minutesSinceLastNudge < minGapMinutes) {
      return {
        shouldSpeak: false,
        reason: `Minimum gap of ${minGapMinutes}m between messages not reached (${minutesSinceLastNudge}m since last nudge).`,
      };
    }
  }

  // ── Trigger Evaluation (prioritized order) ─────────────────────────────────

  // 1. TRIGGER: timetable_unstarted
  // Scheduled item started >= 10m ago and has not been marked started or done
  if (context.unstartedStartedItems.length > 0) {
    const item = context.unstartedStartedItems[0];
    const idempotencyKey = `${context.firebaseUid}:timetable_unstarted:${context.localDate}:${item.start}`;

    // Per-trigger cooldown: not if last nudge was for this exact item
    const isSameRecentNudge =
      context.lastNudge?.trigger === "timetable_unstarted" &&
      context.lastNudge?.message.includes(item.title);

    if (!isSameRecentNudge) {
      return {
        shouldSpeak: true,
        trigger: "timetable_unstarted",
        idempotencyKey,
        reason: `Scheduled item '${item.title}' started ${item.minutesSinceStart}m ago and is not started.`,
        triggerContext: {
          itemTitle: item.title,
          itemStart: item.start,
          itemEnd: item.end,
          minutesSinceStart: item.minutesSinceStart,
        },
      };
    }
  }

  // Parse usual wake/sleep times for time-of-day checks
  const [wakeH, wakeM] = (context.usualWakeTime || "07:30").split(":").map(Number);
  const wakeTotalMins = (wakeH || 7) * 60 + (wakeM || 30);

  const [sleepH, sleepM] = (context.usualBedtime || "23:00").split(":").map(Number);
  const sleepTotalMins = (sleepH || 23) * 60 + (sleepM || 0);

  // 2. TRIGGER: morning_plan (hydrate and plan)
  // Fires in the morning between wake time and 10:30
  if (context.totalMinutes >= wakeTotalMins && context.totalMinutes <= 10 * 60 + 30) {
    const idempotencyKey = `${context.firebaseUid}:morning_plan:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.trigger === "morning_plan" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "morning_plan",
        idempotencyKey,
        reason: "Morning window active: time to hydrate, greet, and check in on daily intentions.",
        triggerContext: {
          wakeTime: context.usualWakeTime,
          hydrationCount: context.hydrationCountToday,
        },
      };
    }
  }

  // 3. TRIGGER: no_timetable
  // User has no timetable today, between 08:30 and 13:30
  if (
    !context.hasScheduleToday &&
    context.totalMinutes >= 8 * 60 + 30 &&
    context.totalMinutes <= 13 * 60 + 30
  ) {
    const idempotencyKey = `${context.firebaseUid}:no_timetable:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.trigger === "no_timetable" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "no_timetable",
        idempotencyKey,
        reason: "No timetable created for today yet during the active morning/midday window.",
        triggerContext: {
          localDate: context.localDate,
        },
      };
    }
  }

  // 4. TRIGGER: mood_followup
  // User had a recent distressed emotion in the last 1-6 hours
  const distressedEmotions = ["stressed", "sad", "anxious", "exhausted", "overwhelmed"];
  const recentDistress = context.recentMoods.find((m) => {
    const ageHours = (Date.now() - new Date(m.createdAt).getTime()) / (1000 * 60 * 60);
    return distressedEmotions.includes(m.emotion.toLowerCase()) && ageHours >= 1 && ageHours <= 6;
  });

  if (recentDistress) {
    const windowBucket = Math.floor(context.currentHour / 4);
    const idempotencyKey = `${context.firebaseUid}:mood_followup:${context.localDate}:${windowBucket}`;
    const recentMoodNudge = context.lastNudge?.trigger === "mood_followup";

    if (!recentMoodNudge) {
      return {
        shouldSpeak: true,
        trigger: "mood_followup",
        idempotencyKey,
        reason: `Recent mood was ${recentDistress.emotion}; checking in gently.`,
        triggerContext: {
          emotion: recentDistress.emotion,
          intensity: recentDistress.intensity,
        },
      };
    }
  }

  // 5. TRIGGER: late_night
  // Current time is after user's usual bedtime, and user was recently active in app
  const isPastBedtime = sleepH >= 12
    ? context.totalMinutes >= sleepTotalMins || context.currentHour < 4
    : context.totalMinutes >= sleepTotalMins && context.currentHour < 12;

  if (isPastBedtime && context.minutesSinceLastSeen !== null && context.minutesSinceLastSeen <= 45) {
    const idempotencyKey = `${context.firebaseUid}:late_night:${context.localDate}`;
    const alreadySentTonight = context.lastNudge?.trigger === "late_night" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentTonight) {
      return {
        shouldSpeak: true,
        trigger: "late_night",
        idempotencyKey,
        reason: `User is active past their usual bedtime (${context.usualBedtime}); gentle rest prompt.`,
        triggerContext: {
          usualBedtime: context.usualBedtime,
          minutesSinceLastSeen: context.minutesSinceLastSeen,
        },
      };
    }
  }

  // 6. TRIGGER: long_session
  // Long continuous session without break or water
  if (context.isLongContinuousSession && context.breakCountToday === 0) {
    const windowBucket = Math.floor(context.currentHour / 3);
    const idempotencyKey = `${context.firebaseUid}:long_session:${context.localDate}:${windowBucket}`;
    const recentSessionNudge = context.lastNudge?.trigger === "long_session";

    if (!recentSessionNudge) {
      return {
        shouldSpeak: true,
        trigger: "long_session",
        idempotencyKey,
        reason: "User has had a long continuous app session without a break; prompt to stretch/hydrate.",
        triggerContext: {
          breakCount: context.breakCountToday,
          hydrationCount: context.hydrationCountToday,
        },
      };
    }
  }

  // 7. TRIGGER: task_overdue
  // Overdue task or stale task/goal (untouched for >= 3 days)
  if (context.overdueTasks.length > 0 || context.staleTasks.length > 0 || context.staleGoals.length > 0) {
    const overdueTask = context.overdueTasks[0];
    const staleTask = context.staleTasks[0];
    const staleGoal = context.staleGoals[0];

    const targetItem = overdueTask || staleTask || staleGoal;
    const isOverdue = Boolean(overdueTask);
    const targetType = overdueTask ? "overdue_task" : staleTask ? "stale_task" : "stale_goal";
    const idempotencyKey = `${context.firebaseUid}:task_overdue:${targetItem.id}:${context.localDate}`;

    const alreadySentRecently = context.lastNudge?.trigger === "task_overdue" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentRecently) {
      return {
        shouldSpeak: true,
        trigger: "task_overdue",
        idempotencyKey,
        reason: isOverdue
          ? `Task '${targetItem.title}' is overdue (${overdueTask.daysOverdue}d overdue).`
          : `Item '${targetItem.title}' has been untouched for ${targetItem.daysSinceUpdated} days.`,
        triggerContext: {
          targetType,
          targetId: targetItem.id,
          targetTitle: targetItem.title,
          daysOverdue: overdueTask?.daysOverdue ?? 0,
          daysSinceUpdated: targetItem.daysSinceUpdated,
        },
      };
    }
  }

  // 8. TRIGGER: long_silence
  // User hasn't talked in >= 24h, during daytime (11:00 - 18:30)
  if (
    context.minutesSinceLastUserMessage !== null &&
    context.minutesSinceLastUserMessage >= 24 * 60 &&
    context.currentHour >= 11 &&
    context.currentHour <= 18
  ) {
    const idempotencyKey = `${context.firebaseUid}:long_silence:${context.localDate}`;
    const alreadySentRecently = context.lastNudge?.trigger === "long_silence";

    if (!alreadySentRecently) {
      return {
        shouldSpeak: true,
        trigger: "long_silence",
        idempotencyKey,
        reason: `User hasn't spoken with Nikki in ${Math.floor(context.minutesSinceLastUserMessage / 60)}h; friendly check-in.`,
        triggerContext: {
          hoursSinceLastMessage: Math.floor(context.minutesSinceLastUserMessage / 60),
        },
      };
    }
  }

  return {
    shouldSpeak: false,
    reason: "No trigger conditions met at this time.",
  };
}

function isSameDay(date: Date, dateStr: string): boolean {
  try {
    const dStr = new Date(date).toISOString().slice(0, 10);
    return dStr === dateStr;
  } catch {
    return false;
  }
}

