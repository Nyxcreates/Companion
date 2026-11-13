import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { decideNikkiNudge } from "../src/lib/nikki/decide.ts";

console.log("==========================================================");
console.log("TEST SUITE: NIKKI PROACTIVE COMPANION BRAIN (decide.ts)");
console.log("==========================================================");

/** Helper to generate a baseline context snapshot */
function createBaseContext(overrides = {}) {
  const currentHour = overrides.currentHour ?? 10;
  const currentMinute = overrides.currentMinute ?? 0;
  const totalMinutes = overrides.totalMinutes ?? (currentHour * 60 + currentMinute);
  const localTime = overrides.localTime ?? `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  return {
    firebaseUid: "user_test_123",
    userName: "Nishtha",
    companionName: "Nikki",
    timezone: "Asia/Kolkata",
    localTime,
    localDate: "2026-11-13",
    currentHour,
    currentMinute,
    totalMinutes,

    quietHoursStart: "22:30",
    quietHoursEnd: "07:00",
    isQuietHours: false,
    isPaused: false,
    pausedUntil: null,
    proactiveEnabled: true,
    strictness: "playful",
    checkInFrequency: "balanced",

    hasScheduleToday: true,
    scheduleItems: [],
    unstartedStartedItems: [],
    missedActivities: [],
    completedActivitiesCountToday: 0,
    completedTasksCountToday: 0,

    activeGoals: [],
    overdueGoals: [],
    staleGoals: [],
    neglectedGoals: [],
    incompleteTasks: [],
    overdueTasks: [],
    staleTasks: [],
    importantUnfinishedTasks: [],
    approachingDeadlineTasks: [],
    avoidanceHistory: {},

    lastUserMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    minutesSinceLastUserMessage: 120,
    lastConversationTopic: null,
    memories: [],

    lastFocusSession: null,
    isFocusSessionJustFinished: false,
    activeFocusSession: null,

    recentJournalEntry: null,

    lastNudge: null,
    recentNudgeOutcomes: [],
    consecutiveIgnoredOrDismissedNudges: 0,
    nudgesSentTodayCount: 0,

    recentMoods: [],
    hydrationCountToday: 1,
    breakCountToday: 1,

    lastSeenAt: new Date(Date.now() - 10 * 60 * 1000),
    minutesSinceLastSeen: 10,
    isFirstOpenOfDay: false,
    isReturningAfterAbsence: false,
    isLongContinuousSession: false,
    usualBedtime: "23:00",
    usualWakeTime: "07:30",
    ...overrides,
  };
}

// ── TEST 1: Quiet Hours Boundary Protection ────────────────────────────────
console.log("\n[TEST 1] Quiet Hours Protection");
{
  const context = createBaseContext({ isQuietHours: true });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, false);
  assert.ok(decision.reason.includes("Quiet hours"));
  console.log("✓ Suppresses messages during quiet hours");
}

// ── TEST 2: Notification Pause Protection ──────────────────────────────────
console.log("\n[TEST 2] Pause Protection");
{
  const context = createBaseContext({ isPaused: true });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, false);
  assert.ok(decision.reason.includes("paused"));
  console.log("✓ Suppresses messages when notifications are paused");
}

// ── TEST 3: Proactive Setting Toggle ───────────────────────────────────────
console.log("\n[TEST 3] Proactive Toggle Check");
{
  const context = createBaseContext({ proactiveEnabled: false });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, false);
  assert.ok(decision.reason.includes("disabled"));
  console.log("✓ Suppresses messages when proactive communication is turned off");
}

// ── TEST 4: Max Unprompted Messages Per Day ────────────────────────────────
console.log("\n[TEST 4] Max Daily Nudges Cap");
{
  const context = createBaseContext({
    nudgesSentTodayCount: 4,
    unstartedStartedItems: [
      { title: "Study DCCN", start: "09:30", end: "10:30", minutesSinceStart: 30 },
    ],
  });
  const decision = decideNikkiNudge(context, { maxDailyNudges: 4 });
  assert.strictEqual(decision.shouldSpeak, false);
  assert.ok(decision.reason.includes("Daily limit"));
  console.log("✓ Enforces max daily unprompted message cap (e.g. 4/day)");
}

// ── TEST 5: Minimum Gap Between Messages ───────────────────────────────────
console.log("\n[TEST 5] Minimum Gap Between Messages");
{
  const context = createBaseContext({
    lastNudge: {
      id: "nudge_recent",
      trigger: "morning_plan",
      message: "Morning!",
      status: "delivered",
      createdAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
    },
    unstartedStartedItems: [
      { title: "Study DCCN", start: "09:30", end: "10:30", minutesSinceStart: 30 },
    ],
  });
  const decision = decideNikkiNudge(context, { minGapMinutes: 90 });
  assert.strictEqual(decision.shouldSpeak, false);
  assert.ok(decision.reason.includes("Minimum gap"));
  console.log("✓ Rejects nudge if minimum gap (90m) has not elapsed since previous nudge");
}

// ── TEST 6: Back-Off After 3 Ignored or Dismissed Nudges ───────────────────
console.log("\n[TEST 6] Back-Off After Ignored / Dismissed Nudges");
{
  const context = createBaseContext({
    consecutiveIgnoredOrDismissedNudges: 3,
    unstartedStartedItems: [
      { title: "Study DCCN", start: "09:30", end: "10:30", minutesSinceStart: 30 },
    ],
  });
  const decision = decideNikkiNudge(context, { backoffThreshold: 3 });
  assert.strictEqual(decision.shouldSpeak, false);
  assert.ok(decision.reason.includes("Backing off"));
  console.log("✓ Backs off completely after 3 consecutive ignored/dismissed nudges");
}

// ── TEST 7: Trigger — focus_finished ───────────────────────────────────────
console.log("\n[TEST 7] Trigger: focus_finished");
{
  const context = createBaseContext({
    isFocusSessionJustFinished: true,
    lastFocusSession: {
      status: "COMPLETED",
      durationMinutes: 45,
      completedAt: new Date(Date.now() - 5 * 60 * 1000),
      taskTitle: "Calculus Problem Set",
    },
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "focus_finished");
  assert.strictEqual(decision.priorityScore, 100);
  assert.strictEqual(decision.triggerContext?.durationMinutes, 45);
  console.log("✓ Fires focus_finished immediately when a focus block completes");
}

// ── TEST 8: Trigger — deadline_approaching ─────────────────────────────────
console.log("\n[TEST 8] Trigger: deadline_approaching");
{
  const context = createBaseContext({
    approachingDeadlineTasks: [
      {
        id: "task_urgent",
        title: "Submit Research Draft",
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
        hoursUntilDue: 2,
        isOverdue: false,
        daysOverdue: 0,
        daysSinceUpdated: 1,
        isStale: false,
        avoidCount: 0,
      },
    ],
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "deadline_approaching");
  assert.strictEqual(decision.priorityScore, 95);
  console.log("✓ Fires deadline_approaching when a task is due in < 4 hours");
}

// ── TEST 9: Trigger — activity_missed ──────────────────────────────────────
console.log("\n[TEST 9] Trigger: activity_missed");
{
  const context = createBaseContext({
    missedActivities: [
      { title: "Gym Workout", start: "08:00", end: "09:00", minutesLate: 60 },
    ],
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "activity_missed");
  assert.strictEqual(decision.priorityScore, 90);
  console.log("✓ Fires activity_missed when scheduled activity ended without completion");
}

// ── TEST 10: Trigger — timetable_unstarted ─────────────────────────────────
console.log("\n[TEST 10] Trigger: timetable_unstarted");
{
  const context = createBaseContext({
    unstartedStartedItems: [
      { title: "Lab Prep", start: "09:40", end: "10:40", minutesSinceStart: 20 },
    ],
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "timetable_unstarted");
  assert.strictEqual(decision.priorityScore, 85);
  console.log("✓ Fires timetable_unstarted when scheduled item started and not marked started");
}

// ── TEST 11: Trigger — unusually_late / late_night ─────────────────────────
console.log("\n[TEST 11] Trigger: late_night");
{
  const context = createBaseContext({
    localTime: "23:45",
    currentHour: 23,
    currentMinute: 45,
    totalMinutes: 23 * 60 + 45,
    usualBedtime: "23:00",
    minutesSinceLastSeen: 5,
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "late_night");
  assert.strictEqual(decision.priorityScore, 80);
  console.log("✓ Fires late_night when user is awake and active past usual bedtime");
}

// ── TEST 12: Trigger — morning_plan ───────────────────────────────────────
console.log("\n[TEST 12] Trigger: morning_plan");
{
  const context = createBaseContext({
    localTime: "08:15",
    currentHour: 8,
    currentMinute: 15,
    totalMinutes: 8 * 60 + 15,
    usualWakeTime: "07:30",
    hasScheduleToday: false,
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "morning_plan");
  assert.strictEqual(decision.priorityScore, 75);
  console.log("✓ Fires morning_plan during morning window after wake time");
}

// ── TEST 13: Trigger — no_timetable ───────────────────────────────────────
console.log("\n[TEST 13] Trigger: no_timetable");
{
  const context = createBaseContext({
    localTime: "11:15",
    currentHour: 11,
    currentMinute: 15,
    totalMinutes: 11 * 60 + 15,
    hasScheduleToday: false,
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "no_timetable");
  assert.strictEqual(decision.priorityScore, 70);
  console.log("✓ Fires no_timetable when daytime has started and schedule is missing");
}

// ── TEST 14: Trigger — evening_checkin ────────────────────────────────────
console.log("\n[TEST 14] Trigger: evening_checkin");
{
  const context = createBaseContext({
    localTime: "20:30",
    currentHour: 20,
    currentMinute: 30,
    totalMinutes: 20 * 60 + 30,
    completedTasksCountToday: 3,
    completedActivitiesCountToday: 2,
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "evening_checkin");
  assert.strictEqual(decision.priorityScore, 68);
  console.log("✓ Fires evening_checkin during evening reflection window");
}

// ── TEST 15: Trigger — user_returned ──────────────────────────────────────
console.log("\n[TEST 15] Trigger: user_returned");
{
  const context = createBaseContext({
    localTime: "16:00",
    currentHour: 16,
    currentMinute: 0,
    totalMinutes: 16 * 60,
    isReturningAfterAbsence: true,
    minutesSinceLastSeen: 260, // ~4.3 hours
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "user_returned");
  assert.strictEqual(decision.priorityScore, 65);
  console.log("✓ Fires user_returned when user is back after several hours absence");
}

// ── TEST 16: Trigger — task_unfinished with Caring Frustration ────────────
console.log("\n[TEST 16] Trigger: task_unfinished (Caring Frustration)");
{
  const context = createBaseContext({
    localTime: "14:00",
    currentHour: 14,
    currentMinute: 0,
    totalMinutes: 14 * 60,
    importantUnfinishedTasks: [
      {
        id: "task_imp_1",
        title: "Finish Operating Systems Assignment",
        dueDate: null,
        isOverdue: false,
        daysOverdue: 0,
        daysSinceUpdated: 2,
        isStale: false,
        priority: "high",
        avoidCount: 3, // Repeatedly avoided!
      },
    ],
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "task_unfinished");
  assert.strictEqual(decision.triggerContext?.isCaringFrustration, true);
  assert.strictEqual(decision.triggerContext?.avoidCount, 3);
  console.log("✓ Activates caring frustration for repeatedly avoided tasks (avoidCount >= 2)");
}

// ── TEST 17: Trigger — goal_neglected with Caring Frustration ─────────────
console.log("\n[TEST 17] Trigger: goal_neglected (Caring Frustration)");
{
  const context = createBaseContext({
    localTime: "15:00",
    currentHour: 15,
    currentMinute: 0,
    totalMinutes: 15 * 60,
    neglectedGoals: [
      {
        id: "goal_neg_1",
        title: "Prepare for GRE Exam",
        category: "academics",
        deadline: null,
        isOverdue: false,
        daysSinceUpdated: 5,
        isStale: true,
        avoidCount: 2, // Avoided twice
      },
    ],
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "goal_neglected");
  assert.strictEqual(decision.triggerContext?.isCaringFrustration, true);
  console.log("✓ Activates caring frustration for neglected goals avoided multiple times");
}

// ── TEST 18: Trigger — long_session ───────────────────────────────────────
console.log("\n[TEST 18] Trigger: long_session");
{
  const context = createBaseContext({
    isLongContinuousSession: true,
    breakCountToday: 0,
    currentHour: 15,
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "long_session");
  console.log("✓ Fires long_session when user has worked continuously without breaks");
}

// ── TEST 19: Trigger — mood_followup ──────────────────────────────────────
console.log("\n[TEST 19] Trigger: mood_followup");
{
  const context = createBaseContext({
    currentHour: 15,
    recentMoods: [
      { emotion: "overwhelmed", intensity: 0.8, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    ],
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "mood_followup");
  console.log("✓ Fires mood_followup after a recent distressed emotion reading");
}

// ── TEST 20: Trigger — user_inactive / long_silence ───────────────────────
console.log("\n[TEST 20] Trigger: long_silence");
{
  const context = createBaseContext({
    minutesSinceLastUserMessage: 28 * 60, // 28 hours
    currentHour: 14,
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "long_silence");
  console.log("✓ Fires long_silence when user hasn't talked in > 24 hours during daytime");
}

console.log("\n==========================================================");
console.log("ALL 20 NIKKI BRAIN DECISION ENGINE TESTS PASSED! (20/20)");
console.log("==========================================================");
