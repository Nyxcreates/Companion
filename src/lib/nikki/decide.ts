import type { NikkiContextSnapshot } from "./context";
import type { NikkiTrigger } from "@/models/NikkiNudge";

export interface NikkiDecision {
  shouldSpeak: boolean;
  trigger?: NikkiTrigger;
  idempotencyKey?: string;
  reason: string;
  priorityScore?: number;
  triggerContext?: Record<string, unknown>;
}

export interface DecideOptions {
  maxDailyNudges?: number;
  minGapMinutes?: number;
  backoffThreshold?: number;
}

const DEFAULT_MAX_DAILY_NUDGES = 4;
const DEFAULT_MIN_GAP_MINUTES = 90;
const DEFAULT_BACKOFF_THRESHOLD = 3;

/**
 * Pure rule-based decision engine: decides IF Nikki should initiate conversation.
 * Cheap pre-check with zero AI or external network calls.
 *
 * Evaluates triggers by priority rank:
 *   Priority 1: Immediate completions, deadlines, missed events
 *   Priority 2: Day routine (morning, evening, missing timetable, late night, return)
 *   Priority 3: Accountability, momentum, and wellbeing
 */
export function decideNikkiNudge(
  context: NikkiContextSnapshot,
  options: DecideOptions = {}
): NikkiDecision {
  // Respect frequency preference for min gaps and daily limits
  const freqGap =
    context.checkInFrequency === "frequent" ? 45 : context.checkInFrequency === "gentle" ? 180 : DEFAULT_MIN_GAP_MINUTES;
  const freqMax =
    context.checkInFrequency === "frequent" ? 6 : context.checkInFrequency === "gentle" ? 2 : DEFAULT_MAX_DAILY_NUDGES;

  const maxDailyNudges = options.maxDailyNudges ?? freqMax;
  const minGapMinutes = options.minGapMinutes ?? freqGap;
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

  // Parse usual wake/sleep times for time-of-day checks
  const [wakeH, wakeM] = (context.usualWakeTime || "07:30").split(":").map(Number);
  const wakeTotalMins = (wakeH || 7) * 60 + (wakeM || 30);

  const [sleepH, sleepM] = (context.usualBedtime || "23:00").split(":").map(Number);
  const sleepTotalMins = (sleepH || 23) * 60 + (sleepM || 0);

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Immediate Real-Time Completions & Urgent Events
  // ═════════════════════════════════════════════════════════════════════════════

  // 1. TRIGGER: focus_finished
  // User just completed a solid focus block (>= 20 mins) within the last 15 mins
  if (context.isFocusSessionJustFinished && context.lastFocusSession) {
    const session = context.lastFocusSession;
    const completedTimestamp = session.completedAt ? new Date(session.completedAt).getTime() : Date.now();
    const idempotencyKey = `${context.firebaseUid}:focus_finished:${context.localDate}:${completedTimestamp}`;

    const alreadyNudgedForThis = context.lastNudge?.idempotencyKey === idempotencyKey;
    if (!alreadyNudgedForThis) {
      return {
        shouldSpeak: true,
        trigger: "focus_finished",
        priorityScore: 100,
        idempotencyKey,
        reason: `User just finished a ${session.durationMinutes}m focus session; celebrate and prompt stretch/hydration.`,
        triggerContext: {
          durationMinutes: session.durationMinutes,
          taskTitle: session.taskTitle || "your focus block",
        },
      };
    }
  }

  // 2. TRIGGER: deadline_approaching
  // A task deadline is approaching within the next 4 hours
  if (context.approachingDeadlineTasks.length > 0) {
    const urgentTask = context.approachingDeadlineTasks[0];
    const idempotencyKey = `${context.firebaseUid}:deadline_approaching:${urgentTask.id}:${context.localDate}`;

    const alreadySentToday = context.lastNudge?.idempotencyKey === idempotencyKey;
    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "deadline_approaching",
        priorityScore: 95,
        idempotencyKey,
        reason: `Task '${urgentTask.title}' has an approaching deadline in ~${urgentTask.hoursUntilDue}h.`,
        triggerContext: {
          taskId: urgentTask.id,
          taskTitle: urgentTask.title,
          hoursUntilDue: urgentTask.hoursUntilDue,
        },
      };
    }
  }

  // 3. TRIGGER: activity_missed
  // Scheduled timetable item ended >= 15m ago and was never started or marked done
  if (context.missedActivities.length > 0) {
    const missed = context.missedActivities[0];
    const idempotencyKey = `${context.firebaseUid}:activity_missed:${context.localDate}:${missed.start}`;

    const alreadySentForThis = context.lastNudge?.idempotencyKey === idempotencyKey;
    if (!alreadySentForThis) {
      return {
        shouldSpeak: true,
        trigger: "activity_missed",
        priorityScore: 90,
        idempotencyKey,
        reason: `Scheduled activity '${missed.title}' ended ~${missed.minutesLate}m ago without completion; check in supportively.`,
        triggerContext: {
          activityTitle: missed.title,
          start: missed.start,
          end: missed.end,
          minutesLate: missed.minutesLate,
        },
      };
    }
  }

  // 4. TRIGGER: timetable_unstarted
  // Scheduled item started >= 10m ago and has not been marked started or done
  if (context.unstartedStartedItems.length > 0) {
    const item = context.unstartedStartedItems[0];
    const idempotencyKey = `${context.firebaseUid}:timetable_unstarted:${context.localDate}:${item.start}`;

    const isSameRecentNudge =
      context.lastNudge?.trigger === "timetable_unstarted" &&
      context.lastNudge?.idempotencyKey === idempotencyKey;

    if (!isSameRecentNudge) {
      return {
        shouldSpeak: true,
        trigger: "timetable_unstarted",
        priorityScore: 85,
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

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Day Routine Milestones & Structure
  // ═════════════════════════════════════════════════════════════════════════════

  // 5. TRIGGER: unusually_late / late_night
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
        priorityScore: 80,
        idempotencyKey,
        reason: `User is active past their bedtime (${context.usualBedtime}); prompt rest and recovery.`,
        triggerContext: {
          usualBedtime: context.usualBedtime,
          minutesSinceLastSeen: context.minutesSinceLastSeen,
        },
      };
    }
  }

  // 6. TRIGGER: morning_checkin / morning_plan
  // Fires in the morning between wake time and 10:30
  if (context.totalMinutes >= wakeTotalMins && context.totalMinutes <= 10 * 60 + 30) {
    const idempotencyKey = `${context.firebaseUid}:morning_plan:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.trigger === "morning_plan" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      const firstTaskTitle =
        context.scheduleItems[0]?.title ||
        context.incompleteTasks[0]?.title ||
        null;

      return {
        shouldSpeak: true,
        trigger: "morning_plan",
        priorityScore: 75,
        idempotencyKey,
        reason: "Morning window active: greet, remind to hydrate, and mention first task.",
        triggerContext: {
          wakeTime: context.usualWakeTime,
          hydrationCount: context.hydrationCountToday,
          firstTaskTitle,
        },
      };
    }
  }

  // 7. TRIGGER: app_opened (First open of the day)
  if (context.isFirstOpenOfDay && context.currentHour < 12) {
    const idempotencyKey = `${context.firebaseUid}:app_opened:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.idempotencyKey === idempotencyKey;

    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "app_opened",
        priorityScore: 72,
        idempotencyKey,
        reason: "First app open of the day; warm wake-up greeting and check-in.",
        triggerContext: {
          localTime: context.localTime,
          userName: context.userName,
        },
      };
    }
  }

  // 8. TRIGGER: no_timetable
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
        priorityScore: 70,
        idempotencyKey,
        reason: "No timetable created for today yet; offer to build one together.",
        triggerContext: {
          localDate: context.localDate,
        },
      };
    }
  }

  // 9. TRIGGER: evening_checkin
  // Fires between 19:30 and 22:00 to reflect on today's wins and encourage winding down
  if (context.totalMinutes >= 19 * 60 + 30 && context.totalMinutes <= 22 * 60) {
    const idempotencyKey = `${context.firebaseUid}:evening_checkin:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.trigger === "evening_checkin" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "evening_checkin",
        priorityScore: 68,
        idempotencyKey,
        reason: "Evening window active; reflect on day's progress and encourage winding down.",
        triggerContext: {
          completedActivitiesCount: context.completedActivitiesCountToday,
          completedTasksCount: context.completedTasksCountToday,
        },
      };
    }
  }

  // 10. TRIGGER: user_returned
  // User returned after an absence of 4+ hours during active daytime hours
  if (context.isReturningAfterAbsence) {
    const windowBucket = Math.floor(context.currentHour / 4);
    const idempotencyKey = `${context.firebaseUid}:user_returned:${context.localDate}:${windowBucket}`;
    const alreadySentRecently = context.lastNudge?.idempotencyKey === idempotencyKey;

    if (!alreadySentRecently) {
      return {
        shouldSpeak: true,
        trigger: "user_returned",
        priorityScore: 65,
        idempotencyKey,
        reason: `User returned after ~${Math.floor((context.minutesSinceLastSeen || 0) / 60)}h absence; warm welcome back.`,
        triggerContext: {
          hoursAway: Math.floor((context.minutesSinceLastSeen || 0) / 60),
        },
      };
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PRIORITY 3: Accountability, Momentum & Emotional Support
  // ═════════════════════════════════════════════════════════════════════════════

  // 11. TRIGGER: task_unfinished (Important priority untouched)
  if (context.importantUnfinishedTasks.length > 0) {
    const task = context.importantUnfinishedTasks[0];
    const idempotencyKey = `${context.firebaseUid}:task_unfinished:${task.id}:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.idempotencyKey === idempotencyKey;

    if (!alreadySentToday) {
      const isCaringFrustration = task.avoidCount >= 2;
      return {
        shouldSpeak: true,
        trigger: "task_unfinished",
        priorityScore: 60,
        idempotencyKey,
        reason: isCaringFrustration
          ? `Important task '${task.title}' has been avoided ${task.avoidCount} times; caring frustration check-in.`
          : `Important task '${task.title}' remains unfinished today.`,
        triggerContext: {
          taskId: task.id,
          taskTitle: task.title,
          priority: task.priority,
          avoidCount: task.avoidCount,
          isCaringFrustration,
        },
      };
    }
  }

  // 12. TRIGGER: goal_neglected / stale goal
  if (context.neglectedGoals.length > 0) {
    const goal = context.neglectedGoals[0];
    const idempotencyKey = `${context.firebaseUid}:goal_neglected:${goal.id}:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.idempotencyKey === idempotencyKey;

    if (!alreadySentToday) {
      const isCaringFrustration = goal.avoidCount >= 2;
      return {
        shouldSpeak: true,
        trigger: "goal_neglected",
        priorityScore: 55,
        idempotencyKey,
        reason: isCaringFrustration
          ? `Goal '${goal.title}' avoided ${goal.avoidCount} times; caring frustration check-in.`
          : `Goal '${goal.title}' has been untouched for ${goal.daysSinceUpdated} days.`,
        triggerContext: {
          goalId: goal.id,
          goalTitle: goal.title,
          daysSinceUpdated: goal.daysSinceUpdated,
          avoidCount: goal.avoidCount,
          isCaringFrustration,
        },
      };
    }
  }

  // 13. TRIGGER: task_overdue
  if (context.overdueTasks.length > 0 || context.staleTasks.length > 0) {
    const task = context.overdueTasks[0] || context.staleTasks[0];
    const isOverdue = Boolean(context.overdueTasks[0]);
    const idempotencyKey = `${context.firebaseUid}:task_overdue:${task.id}:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.trigger === "task_overdue" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      const isCaringFrustration = task.avoidCount >= 2;
      return {
        shouldSpeak: true,
        trigger: "task_overdue",
        priorityScore: 50,
        idempotencyKey,
        reason: isOverdue
          ? `Task '${task.title}' is overdue (${task.daysOverdue}d overdue).`
          : `Task '${task.title}' untouched for ${task.daysSinceUpdated} days.`,
        triggerContext: {
          targetId: task.id,
          targetTitle: task.title,
          daysOverdue: task.daysOverdue,
          daysSinceUpdated: task.daysSinceUpdated,
          avoidCount: task.avoidCount,
          isCaringFrustration,
        },
      };
    }
  }

  // 14. TRIGGER: long_session
  if (context.isLongContinuousSession && context.breakCountToday === 0) {
    const windowBucket = Math.floor(context.currentHour / 3);
    const idempotencyKey = `${context.firebaseUid}:long_session:${context.localDate}:${windowBucket}`;
    const recentSessionNudge = context.lastNudge?.trigger === "long_session";

    if (!recentSessionNudge) {
      return {
        shouldSpeak: true,
        trigger: "long_session",
        priorityScore: 45,
        idempotencyKey,
        reason: "User has had a long continuous app session without a break; prompt stretch/hydrate.",
        triggerContext: {
          breakCount: context.breakCountToday,
          hydrationCount: context.hydrationCountToday,
        },
      };
    }
  }

  // 15. TRIGGER: mood_followup
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
        priorityScore: 40,
        idempotencyKey,
        reason: `Recent mood was ${recentDistress.emotion}; checking in gently.`,
        triggerContext: {
          emotion: recentDistress.emotion,
          intensity: recentDistress.intensity,
        },
      };
    }
  }

  // 16. TRIGGER: user_inactive / long_silence
  if (
    context.minutesSinceLastUserMessage !== null &&
    context.minutesSinceLastUserMessage >= 24 * 60 &&
    context.currentHour >= 11 &&
    context.currentHour <= 18
  ) {
    const idempotencyKey = `${context.firebaseUid}:long_silence:${context.localDate}`;
    const alreadySentRecently = context.lastNudge?.trigger === "long_silence" || context.lastNudge?.trigger === "user_inactive";

    if (!alreadySentRecently) {
      return {
        shouldSpeak: true,
        trigger: "long_silence",
        priorityScore: 30,
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
