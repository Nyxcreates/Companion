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

  // Parse usual wake/sleep times for time-of-day checks
  const [wakeH, wakeM] = (context.usualWakeTime || "07:30").split(":").map(Number);
  const wakeTotalMins = (wakeH || 7) * 60 + (wakeM || 30);

  const [sleepH, sleepM] = (context.usualBedtime || "23:00").split(":").map(Number);
  const sleepTotalMins = (sleepH || 23) * 60 + (sleepM || 0);

  // ── Sleep Reminder & Snooze Evaluation (runs even if quiet hours just started) ──
  const inActiveConversation =
    context.minutesSinceLastUserMessage !== null && context.minutesSinceLastUserMessage < 10;

  if (
    context.sleepReminderEnabled !== false &&
    context.sleepDismissedForDate !== context.localDate &&
    !inActiveConversation
  ) {
    const nowMs = Date.now();
    if (context.sleepSnoozeUntil) {
      const snoozeMs = new Date(context.sleepSnoozeUntil).getTime();
      if (nowMs >= snoozeMs) {
        const snoozeBucket = Math.floor(snoozeMs / 60000);
        const idempotencyKey = `${context.firebaseUid}:sleep_reminder:${context.localDate}:snooze:${snoozeBucket}`;
        if (context.lastNudge?.idempotencyKey !== idempotencyKey) {
          return {
            shouldSpeak: true,
            trigger: "sleep_reminder",
            priorityScore: 98,
            idempotencyKey,
            reason: `Snoozed sleep reminder is due again (bedtime ${context.usualBedtime}).`,
            triggerContext: {
              usualBedtime: context.usualBedtime,
              snoozeMinutes: context.sleepReminderSnoozeMinutes,
              isSnoozeRepeat: true,
            },
          };
        }
      }
    } else {
      const approachMins = sleepTotalMins - 20;
      const isApproachingOrPastBedtime =
        sleepH >= 12
          ? context.totalMinutes >= approachMins || context.currentHour < 4
          : context.totalMinutes >= approachMins && context.currentHour < 12;

      if (isApproachingOrPastBedtime) {
        const idempotencyKey = `${context.firebaseUid}:sleep_reminder:${context.localDate}`;
        const alreadySentTonight =
          (context.lastNudge?.trigger === "sleep_reminder" || context.lastNudge?.trigger === "late_night") &&
          isSameDay(context.lastNudge.createdAt, context.localDate);

        if (!alreadySentTonight) {
          return {
            shouldSpeak: true,
            trigger: "sleep_reminder",
            priorityScore: 88,
            idempotencyKey,
            reason: `Approaching or past user's preferred bedtime (${context.usualBedtime}).`,
            triggerContext: {
              usualBedtime: context.usualBedtime,
              snoozeMinutes: context.sleepReminderSnoozeMinutes,
              isPastBedtime: context.totalMinutes >= sleepTotalMins || context.currentHour < 4,
            },
          };
        }
      }
    }
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
  // A task deadline is approaching within the next 4 hours (or detected by Part 4B)
  const approachingTask =
    context.approachingDeadlineTasks[0] ||
    (context.goalTaskDetections?.tasksApproachingDeadline?.[0]
      ? {
          id: context.goalTaskDetections.tasksApproachingDeadline[0].targetId || "task",
          title: context.goalTaskDetections.tasksApproachingDeadline[0].targetTitle || "your task",
          hoursUntilDue: Number(context.goalTaskDetections.tasksApproachingDeadline[0].details?.hoursUntilDue ?? 4),
        }
      : null);

  if (approachingTask) {
    const idempotencyKey = `${context.firebaseUid}:deadline_approaching:${approachingTask.id}:${context.localDate}`;

    const alreadySentToday = context.lastNudge?.idempotencyKey === idempotencyKey;
    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "deadline_approaching",
        priorityScore: 95,
        idempotencyKey,
        reason: `Task '${approachingTask.title}' has an approaching deadline in ~${approachingTask.hoursUntilDue}h.`,
        triggerContext: {
          taskId: approachingTask.id,
          taskTitle: approachingTask.title,
          hoursUntilDue: approachingTask.hoursUntilDue,
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

  // ── Guard 7: Do not interrupt active conversations unnecessarily ─────────────
  // Urgent Priority 1 events above can still surface, but routine & accountability
  // nudges wait until the user hasn't sent a chat message for at least 10 minutes.
  if (context.minutesSinceLastUserMessage !== null && context.minutesSinceLastUserMessage < 10) {
    return {
      shouldSpeak: false,
      reason: `Active conversation in progress (${context.minutesSinceLastUserMessage}m since last user message); deferring non-urgent nudge.`,
    };
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

  // 5b. TRIGGER: overload_warning — 7+ pending tasks in morning window
  if (
    context.totalPendingTasksCount >= 7 &&
    context.currentHour >= 8 &&
    context.currentHour <= 11
  ) {
    const idempotencyKey = `${context.firebaseUid}:overload_warning:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.trigger === "overload_warning" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "overload_warning",
        priorityScore: 76,
        idempotencyKey,
        reason: `User has ${context.totalPendingTasksCount} pending tasks — potential overload; offer to prioritise.`,
        triggerContext: {
          totalPendingCount: context.totalPendingTasksCount,
        },
      };
    }
  }

  // 6. TRIGGER: morning_checkin / morning_plan
  // Fires in the morning starting at user's preferred morningCheckInTime (default 08:00) through +2.5h
  const [mH, mM] = (context.morningCheckInTime || "08:00").split(":").map(Number);
  const morningStartMins = (Number.isFinite(mH) ? mH : 8) * 60 + (Number.isFinite(mM) ? mM : 0);
  const morningEndMins = Math.max(morningStartMins + 150, 10 * 60 + 30);

  if (
    context.morningCheckInEnabled !== false &&
    context.totalMinutes >= Math.max(wakeTotalMins, morningStartMins) &&
    context.totalMinutes <= morningEndMins
  ) {
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
  // Fires starting at user's preferred eveningCheckInTime (default 20:00) through +2h (or 22:00)
  const [eH, eM] = (context.eveningCheckInTime || "20:00").split(":").map(Number);
  const eveningStartMins = (Number.isFinite(eH) ? eH : 20) * 60 + (Number.isFinite(eM) ? eM : 0);
  const eveningEndMins = Math.max(eveningStartMins + 120, 22 * 60);

  if (
    context.eveningCheckInEnabled !== false &&
    context.totalMinutes >= eveningStartMins &&
    context.totalMinutes <= eveningEndMins
  ) {
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

  // 11b. TRIGGER: task_celebration
  // User completed 3+ tasks today or has a goal making strong progress (afternoon window)
  const goodProgressGoal = context.goalsMakingGoodProgress?.[0];
  if (
    (context.completedTasksCountToday >= 3 || Boolean(goodProgressGoal)) &&
    context.currentHour >= 13 &&
    context.currentHour <= 19
  ) {
    const idempotencyKey =
      context.completedTasksCountToday >= 3
        ? `${context.firebaseUid}:task_celebration:${context.localDate}`
        : `${context.firebaseUid}:task_celebration:goal:${goodProgressGoal?.id}:${context.localDate}`;
    const alreadySentToday =
      context.lastNudge?.trigger === "task_celebration" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "task_celebration",
        priorityScore: 58,
        idempotencyKey,
        reason:
          context.completedTasksCountToday >= 3
            ? `User completed ${context.completedTasksCountToday} tasks today — genuine momentum worth celebrating.`
            : `Goal '${goodProgressGoal?.title}' is making strong progress (${goodProgressGoal?.progressPercent ?? "great"}%) — celebrate momentum.`,
        triggerContext: {
          completedCount: context.completedTasksCountToday,
          goalId: goodProgressGoal?.id,
          goalTitle: goodProgressGoal?.title,
          progressPercent: goodProgressGoal?.progressPercent,
        },
      };
    }
  }

  // 12. TRIGGER: goal_neglected / stale goal — high-priority first
  // High-priority neglected goals fire before medium/low-priority ones (also reads Part 4B detections)
  const detectedNeglectedGoals =
    context.neglectedGoals.length > 0
      ? context.neglectedGoals
      : (context.goalTaskDetections?.importantGoalsNoProgress || []).map((d) => ({
          id: d.targetId || "goal",
          title: d.targetTitle || "your goal",
          priority: String(d.details?.priority || "HIGH"),
          daysSinceUpdated: Number(d.details?.daysSinceUpdated ?? 3),
          avoidCount: Number(d.details?.avoidCount ?? 0),
          progressPercent: (d.details?.progressPercent as number | null) ?? null,
        }));

  if (detectedNeglectedGoals.length > 0) {
    // Sort: HIGH priority first, then by days since updated (most neglected first)
    const sortedNeglected = [...detectedNeglectedGoals].sort((a, b) => {
      const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const pa = priorityOrder[(a as { priority?: string }).priority ?? "MEDIUM"] ?? 1;
      const pb = priorityOrder[(b as { priority?: string }).priority ?? "MEDIUM"] ?? 1;
      if (pa !== pb) return pa - pb;
      return b.daysSinceUpdated - a.daysSinceUpdated;
    });
    const goal = sortedNeglected[0];
    const idempotencyKey = `${context.firebaseUid}:goal_neglected:${goal.id}:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.idempotencyKey === idempotencyKey;

    if (!alreadySentToday) {
      const isCaringFrustration = goal.avoidCount >= 2;
      const goalPriority = (goal as { priority?: string }).priority ?? "MEDIUM";
      return {
        shouldSpeak: true,
        trigger: "goal_neglected",
        priorityScore: goalPriority === "HIGH" ? 57 : 55,
        idempotencyKey,
        reason: isCaringFrustration
          ? `Goal '${goal.title}' avoided ${goal.avoidCount} times; caring frustration check-in.`
          : `Goal '${goal.title}' has been untouched for ${goal.daysSinceUpdated} days.`,
        triggerContext: {
          goalId: goal.id,
          goalTitle: goal.title,
          goalPriority,
          daysSinceUpdated: goal.daysSinceUpdated,
          avoidCount: goal.avoidCount,
          isCaringFrustration,
          progressPercent: (goal as { progressPercent?: number | null }).progressPercent ?? null,
        },
      };
    }
  }

  // 13. TRIGGER: task_overdue (also catches repeatedly postponed tasks from Part 4A/4B)
  const postponedFallback =
    context.repeatedlyPostponedTasks?.[0] ||
    (context.goalTaskDetections?.tasksRepeatedlyPostponed?.[0]
      ? {
          id: context.goalTaskDetections.tasksRepeatedlyPostponed[0].targetId || "task",
          title: context.goalTaskDetections.tasksRepeatedlyPostponed[0].targetTitle || "your task",
          daysOverdue: 0,
          daysSinceUpdated: 0,
          avoidCount: Number(context.goalTaskDetections.tasksRepeatedlyPostponed[0].details?.postponeCount ?? 2),
        }
      : null);

  if (context.overdueTasks.length > 0 || context.staleTasks.length > 0 || postponedFallback) {
    const task = context.overdueTasks[0] || context.staleTasks[0] || postponedFallback!;
    const isOverdue = Boolean(context.overdueTasks[0]);
    const idempotencyKey = `${context.firebaseUid}:task_overdue:${task.id}:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.trigger === "task_overdue" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      const isCaringFrustration = task.avoidCount >= 2 || Boolean(postponedFallback && !isOverdue && !context.staleTasks[0]);
      return {
        shouldSpeak: true,
        trigger: "task_overdue",
        priorityScore: 50,
        idempotencyKey,
        reason: isOverdue
          ? `Task '${task.title}' is overdue (${task.daysOverdue}d overdue).`
          : isCaringFrustration
          ? `Task '${task.title}' has been repeatedly postponed (${task.avoidCount} times).`
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

  // 14. TRIGGER: task_celebration — user completed 3+ tasks today (afternoon window)
  if (
    context.completedTasksCountToday >= 3 &&
    context.currentHour >= 13 &&
    context.currentHour <= 19
  ) {
    const idempotencyKey = `${context.firebaseUid}:task_celebration:${context.localDate}`;
    const alreadySentToday = context.lastNudge?.trigger === "task_celebration" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "task_celebration",
        priorityScore: 48,
        idempotencyKey,
        reason: `User completed ${context.completedTasksCountToday} tasks today — genuine momentum worth celebrating.`,
        triggerContext: {
          completedCount: context.completedTasksCountToday,
        },
      };
    }
  }


  // 15. TRIGGER: long_session
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

  // 16. TRIGGER: upcoming_activity (scheduled block starting in 5-25 mins)
  if (context.upcomingActivities.length > 0) {
    const upcoming = context.upcomingActivities[0];
    const isStudy = /\b(study|revision|revise|homework|assignment|exam|class|lecture|focus|read|practice)\b/i.test(
      upcoming.title
    ) || upcoming.type === "focus" || upcoming.type === "study";

    if (isStudy && context.studyRemindersEnabled !== false && !context.isUserExhausted) {
      const idempotencyKey = `${context.firebaseUid}:study_reminder:${context.localDate}:${upcoming.start}`;
      if (context.lastNudge?.idempotencyKey !== idempotencyKey) {
        return {
          shouldSpeak: true,
          trigger: "study_reminder",
          priorityScore: 62,
          idempotencyKey,
          reason: `Upcoming study block '${upcoming.title}' starts in ${upcoming.minutesUntilStart}m.`,
          triggerContext: {
            itemTitle: upcoming.title,
            itemStart: upcoming.start,
            itemEnd: upcoming.end,
            minutesUntilStart: upcoming.minutesUntilStart,
          },
        };
      }
    } else {
      const idempotencyKey = `${context.firebaseUid}:upcoming_activity:${context.localDate}:${upcoming.start}`;
      if (context.lastNudge?.idempotencyKey !== idempotencyKey) {
        return {
          shouldSpeak: true,
          trigger: "upcoming_activity",
          priorityScore: 52,
          idempotencyKey,
          reason: `Upcoming scheduled activity '${upcoming.title}' starts in ${upcoming.minutesUntilStart}m.`,
          triggerContext: {
            itemTitle: upcoming.title,
            itemStart: upcoming.start,
            itemEnd: upcoming.end,
            minutesUntilStart: upcoming.minutesUntilStart,
          },
        };
      }
    }
  }

  // 17. TRIGGER: study_reminder (pending study/assignment task when not exhausted)
  if (
    context.studyRemindersEnabled !== false &&
    !context.isUserExhausted &&
    context.currentHour >= 9 &&
    context.currentHour <= 21
  ) {
    const studyTask = context.pendingTasks.find((t) =>
      /\b(study|revision|revise|homework|assignment|exam|project|practice|read|course|lecture)\b/i.test(t.title)
    );
    if (studyTask) {
      const idempotencyKey = `${context.firebaseUid}:study_reminder:task:${studyTask.id}:${context.localDate}`;
      const alreadySentToday =
        context.lastNudge?.trigger === "study_reminder" &&
        isSameDay(context.lastNudge.createdAt, context.localDate);
      if (!alreadySentToday && context.lastNudge?.idempotencyKey !== idempotencyKey) {
        return {
          shouldSpeak: true,
          trigger: "study_reminder",
          priorityScore: 42,
          idempotencyKey,
          reason: `Pending study task '${studyTask.title}' — gentle invitation to start a realistic session.`,
          triggerContext: {
            taskId: studyTask.id,
            taskTitle: studyTask.title,
          },
        };
      }
    }
  }

  // 18. TRIGGER: hobby_reminder (scheduled hobby first, then active hobby goal, max 1/day)
  if (
    context.hobbyRemindersEnabled !== false &&
    context.hobbyCandidates.length > 0 &&
    context.currentHour >= 10 &&
    context.currentHour <= 21
  ) {
    const candidate =
      context.hobbyCandidates.find((c) => c.source === "schedule") ||
      context.hobbyCandidates[0];
    const idempotencyKey = `${context.firebaseUid}:hobby_reminder:${context.localDate}`;
    const alreadySentToday =
      context.lastNudge?.trigger === "hobby_reminder" &&
      isSameDay(context.lastNudge.createdAt, context.localDate);

    if (!alreadySentToday) {
      return {
        shouldSpeak: true,
        trigger: "hobby_reminder",
        priorityScore: 36,
        idempotencyKey,
        reason: `Gentle reminder for hobby/personal time: '${candidate.title}'.`,
        triggerContext: {
          hobbyTitle: candidate.title,
          source: candidate.source,
          goalId: candidate.goalId,
          start: candidate.start,
        },
      };
    }
  }

  // 19. TRIGGER: general_checkin (gentle daytime check-in within frequency limits)
  if (context.currentHour >= 10 && context.currentHour <= 20) {
    const windowBucket = Math.floor(context.currentHour / 5);
    const idempotencyKey = `${context.firebaseUid}:general_checkin:${context.localDate}:${windowBucket}`;
    const alreadySentRecently =
      context.lastNudge?.idempotencyKey === idempotencyKey ||
      (context.lastNudge?.trigger === "general_checkin" &&
        isSameDay(context.lastNudge.createdAt, context.localDate));

    if (!alreadySentRecently) {
      return {
        shouldSpeak: true,
        trigger: "general_checkin",
        priorityScore: 25,
        idempotencyKey,
        reason: "Gentle general check-in with the user.",
        triggerContext: {
          userName: context.userName,
        },
      };
    }
  }

  // 20. TRIGGER: user_inactive / long_silence
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
