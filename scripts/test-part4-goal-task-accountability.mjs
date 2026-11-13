import assert from "node:assert";
import { decideNikkiNudge } from "../src/lib/nikki/decide.ts";

console.log("=================================================================");
console.log("TEST SUITE: NIKKI PART 4 — GOAL & TASK ACCOUNTABILITY (decide.ts)");
console.log("=================================================================");

/** Helper to generate a baseline context snapshot */
function createBaseContext(overrides = {}) {
  const currentHour = overrides.currentHour ?? 14;
  const currentMinute = overrides.currentMinute ?? 0;
  const totalMinutes = overrides.totalMinutes ?? (currentHour * 60 + currentMinute);
  const localTime =
    overrides.localTime ??
    `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  return {
    firebaseUid: "user_part4_test",
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
    highPriorityNeglectedGoals: [],
    incompleteTasks: [],
    overdueTasks: [],
    staleTasks: [],
    importantUnfinishedTasks: [],
    approachingDeadlineTasks: [],
    avoidanceHistory: {},
    totalPendingTasksCount: 0,

    lastUserMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
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

    lastSeenAt: new Date(Date.now() - 5 * 60 * 1000),
    minutesSinceLastSeen: 5,
    isFirstOpenOfDay: false,
    isReturningAfterAbsence: false,
    isLongContinuousSession: false,
    usualBedtime: "23:00",
    usualWakeTime: "07:30",
    ...overrides,
  };
}

// ── TEST 1: Goal neglected — HIGH priority → fires goal_neglected ───────────
console.log("\n[TEST 1] Goal neglected — HIGH priority");
{
  const highPriorityGoal = {
    id: "goal_hi_1",
    title: "Learn Machine Learning",
    category: "education",
    priority: "HIGH",
    deadline: null,
    isOverdue: false,
    daysSinceUpdated: 7,
    isStale: true,
    avoidCount: 0,
    progressPercent: 20,
  };

  const context = createBaseContext({
    currentHour: 15,
    neglectedGoals: [highPriorityGoal],
    highPriorityNeglectedGoals: [highPriorityGoal],
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true, "shouldSpeak should be true");
  assert.strictEqual(decision.trigger, "goal_neglected", `trigger should be 'goal_neglected', got '${decision.trigger}'`);
  assert.strictEqual(decision.priorityScore, 57, `priorityScore should be 57, got ${decision.priorityScore}`);
  console.log("✓ Test 1 passed — goal_neglected fires for HIGH priority neglected goal (score 57)");
}

// ── TEST 2: Task celebration — 3+ tasks completed today ─────────────────────
console.log("\n[TEST 2] Task celebration — 3+ tasks completed today");
{
  const context = createBaseContext({
    currentHour: 15,
    completedTasksCountToday: 3,
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true, "shouldSpeak should be true");
  assert.strictEqual(decision.trigger, "task_celebration", `trigger should be 'task_celebration', got '${decision.trigger}'`);
  console.log("✓ Test 2 passed — task_celebration fires when 3+ tasks completed in afternoon window");
}

// ── TEST 3: Overdue task + caring frustration (avoidCount >= 2) ─────────────
console.log("\n[TEST 3] Overdue task + caring frustration (avoidCount >= 2)");
{
  const context = createBaseContext({
    currentHour: 14,
    overdueTasks: [
      {
        id: "task_od_1",
        title: "Submit Assignment",
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        isOverdue: true,
        daysOverdue: 2,
        daysSinceUpdated: 3,
        isStale: false,
        priority: "medium",
        avoidCount: 3,
      },
    ],
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true, "shouldSpeak should be true");
  assert.strictEqual(decision.trigger, "task_overdue", `trigger should be 'task_overdue', got '${decision.trigger}'`);
  assert.strictEqual(
    decision.triggerContext?.isCaringFrustration,
    true,
    `isCaringFrustration should be true, got ${decision.triggerContext?.isCaringFrustration}`
  );
  console.log("✓ Test 3 passed — task_overdue fires with isCaringFrustration=true for avoidCount >= 2");
}

// ── TEST 4: Task approaching deadline (< 4 hours) ───────────────────────────
console.log("\n[TEST 4] Task approaching deadline (< 4 hours)");
{
  const context = createBaseContext({
    currentHour: 10,
    approachingDeadlineTasks: [
      {
        id: "task_dl_1",
        title: "Project Submission",
        dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
        hoursUntilDue: 3,
        isOverdue: false,
        daysOverdue: 0,
        daysSinceUpdated: 0,
        isStale: false,
        avoidCount: 0,
      },
    ],
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true, "shouldSpeak should be true");
  assert.strictEqual(decision.trigger, "deadline_approaching", `trigger should be 'deadline_approaching', got '${decision.trigger}'`);
  assert.strictEqual(decision.priorityScore, 95, `priorityScore should be 95, got ${decision.priorityScore}`);
  console.log("✓ Test 4 passed — deadline_approaching fires for task due in < 4 hours (score 95)");
}

// ── TEST 5: Postponed/stale task (not high priority, 4+ days untouched) ─────
console.log("\n[TEST 5] Stale task (4+ days untouched) → fires task_overdue");
{
  const context = createBaseContext({
    currentHour: 14,
    staleTasks: [
      {
        id: "task_st_1",
        title: "Research Paper Draft",
        dueDate: null,
        isOverdue: false,
        daysOverdue: 0,
        daysSinceUpdated: 5,
        isStale: true,
        priority: "medium",
        avoidCount: 1,
      },
    ],
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true, "shouldSpeak should be true");
  assert.strictEqual(decision.trigger, "task_overdue", `trigger should be 'task_overdue', got '${decision.trigger}'`);
  console.log("✓ Test 5 passed — task_overdue fires for stale task (4+ days untouched)");
}

// ── TEST 6: Overload warning (7+ pending tasks, morning hours) ───────────────
console.log("\n[TEST 6] Overload warning — 7+ pending tasks in morning window");
{
  const context = createBaseContext({
    currentHour: 9,
    totalPendingTasksCount: 9,
    incompleteTasks: Array(9)
      .fill(null)
      .map((_, i) => ({
        id: `task_pending_${i}`,
        title: `Task ${i + 1}`,
        dueDate: null,
        isOverdue: false,
        daysOverdue: 0,
        daysSinceUpdated: 1,
        isStale: false,
        priority: "medium",
        avoidCount: 0,
      })),
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true, "shouldSpeak should be true");
  assert.strictEqual(decision.trigger, "overload_warning", `trigger should be 'overload_warning', got '${decision.trigger}'`);
  console.log("✓ Test 6 passed — overload_warning fires for 7+ pending tasks in morning hours");
}

// ── TEST 7: Priority ordering — focus_finished beats goal_neglected ──────────
console.log("\n[TEST 7] Priority ordering — focus_finished beats goal_neglected");
{
  const context = createBaseContext({
    currentHour: 15,
    isFocusSessionJustFinished: true,
    lastFocusSession: {
      status: "COMPLETED",
      durationMinutes: 30,
      completedAt: new Date(Date.now() - 3 * 60 * 1000),
    },
    neglectedGoals: [
      {
        id: "goal_neg_2",
        title: "Prepare GRE",
        category: "academics",
        priority: "HIGH",
        deadline: null,
        isOverdue: false,
        daysSinceUpdated: 6,
        isStale: true,
        avoidCount: 2,
        progressPercent: null,
      },
    ],
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true, "shouldSpeak should be true");
  assert.strictEqual(
    decision.trigger,
    "focus_finished",
    `trigger should be 'focus_finished' (not 'goal_neglected'), got '${decision.trigger}'`
  );
  console.log("✓ Test 7 passed — focus_finished (score 100) beats goal_neglected (score 57) in priority ordering");
}

console.log("\n=================================================================");
console.log("ALL 7 GOAL & TASK ACCOUNTABILITY TESTS PASSED! (7/7)");
console.log("=================================================================");
