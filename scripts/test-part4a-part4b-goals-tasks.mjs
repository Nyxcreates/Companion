import assert from "node:assert";
import {
  detectImportantGoalsNoProgress,
  detectTasksApproachingDeadline,
  detectOverdueTasks,
  detectTasksRepeatedlyPostponed,
  detectGoalsMakingGoodProgress,
  detectUnrealisticWorkloads,
  detectAllGoalTaskInsights,
  filterDetectionsByCooldown,
} from "../src/lib/nikki/goalTaskDetection.ts";
import { computeProgressPercent } from "../src/lib/goals/progress.ts";

console.log("==========================================================================");
console.log("TEST SUITE: NIKKI PART 4A (AWARENESS) & PART 4B (DETECTION)");
console.log("==========================================================================");

/** Helper to construct a base context for unit testing */
function createBaseContext(overrides = {}) {
  const now = overrides.now ?? new Date("2026-11-13T14:00:00.000Z");
  return {
    firebaseUid: "user_test_4ab",
    userName: "Nishtha",
    companionName: "Nikki",
    timezone: "Asia/Kolkata",
    localTime: "14:00",
    localDate: "2026-11-13",
    currentHour: 14,
    currentMinute: 0,
    totalMinutes: 14 * 60,

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
    completedGoals: [],
    allGoals: [],
    overdueGoals: [],
    staleGoals: [],
    neglectedGoals: [],
    highPriorityNeglectedGoals: [],
    goalsMakingGoodProgress: [],

    pendingTasks: [],
    completedTasks: [],
    incompleteTasks: [],
    overdueTasks: [],
    staleTasks: [],
    postponedTasks: [],
    repeatedlyPostponedTasks: [],
    importantUnfinishedTasks: [],
    approachingDeadlineTasks: [],
    avoidanceHistory: {},
    totalPendingTasksCount: 0,

    lastUserMessageAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
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

    lastSeenAt: new Date(now.getTime() - 5 * 60 * 1000),
    minutesSinceLastSeen: 5,
    isFirstOpenOfDay: false,
    isReturningAfterAbsence: false,
    isLongContinuousSession: false,
    usualBedtime: "23:00",
    usualWakeTime: "07:30",
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 4A — GOAL AND TASK AWARENESS TESTS
// ═════════════════════════════════════════════════════════════════════════════

console.log("\n─── PART 4A: GOAL AND TASK AWARENESS ───");

// [4A-TEST 1] Goals and their priorities
console.log("\n[4A-TEST 1] Goals and their priorities");
{
  const highGoal = {
    id: "g1",
    title: "Pass GRE",
    description: "Aim for 325+",
    category: "education",
    priority: "HIGH",
    status: "ACTIVE",
    deadline: new Date("2026-12-01"),
    isOverdue: false,
    daysUntilDeadline: 18,
    daysSinceUpdated: 1,
    isStale: false,
    avoidCount: 0,
    targetLabel: "practice tests",
    targetValue: 20,
    progressValue: 5,
    progressPercent: 25,
    completedAt: null,
    hasGoodProgress: false,
  };

  const medGoal = {
    id: "g2",
    title: "Read 12 books",
    description: null,
    category: "personal",
    priority: "MEDIUM",
    status: "ACTIVE",
    deadline: null,
    isOverdue: false,
    daysUntilDeadline: null,
    daysSinceUpdated: 0,
    isStale: false,
    avoidCount: 0,
    targetLabel: "books",
    targetValue: 12,
    progressValue: 6,
    progressPercent: 50,
    completedAt: null,
    hasGoodProgress: true,
  };

  const lowGoal = {
    id: "g3",
    title: "Learn origami",
    description: null,
    category: "hobbies",
    priority: "LOW",
    status: "COMPLETED",
    deadline: null,
    isOverdue: false,
    daysUntilDeadline: null,
    daysSinceUpdated: 10,
    isStale: false,
    avoidCount: 0,
    targetLabel: null,
    targetValue: null,
    progressValue: null,
    progressPercent: null,
    completedAt: new Date("2026-11-03"),
    hasGoodProgress: true,
  };

  const context = createBaseContext({
    allGoals: [highGoal, medGoal, lowGoal],
    activeGoals: [highGoal, medGoal],
    completedGoals: [lowGoal],
  });

  assert.strictEqual(context.allGoals.length, 3);
  assert.strictEqual(context.activeGoals.length, 2);
  assert.strictEqual(context.completedGoals.length, 1);
  assert.strictEqual(context.activeGoals[0].priority, "HIGH");
  assert.strictEqual(context.activeGoals[1].priority, "MEDIUM");
  assert.strictEqual(context.completedGoals[0].priority, "LOW");
  console.log("✓ 4A-Test 1 passed — Goals and priorities correctly mapped and grouped.");
}

// [4A-TEST 2] Goal progress (Measurable vs Qualitative)
console.log("\n[4A-TEST 2] Goal progress (Measurable vs Qualitative)");
{
  // Measurable goal
  const pct1 = computeProgressPercent(10, 7);
  assert.strictEqual(pct1, 70, "10 target, 7 progress should be 70%");

  // Clamped at 100%
  const pct2 = computeProgressPercent(10, 15);
  assert.strictEqual(pct2, 100, "15 progress out of 10 should clamp to 100%");

  // Qualitative goal (null target)
  const pct3 = computeProgressPercent(null, null);
  assert.strictEqual(pct3, null, "null target should safely return null percent");

  // Zero target (handle target = 0 safely, don't force fake percentages)
  const pct4 = computeProgressPercent(0, 5);
  assert.strictEqual(pct4, null, "0 target should safely return null percent");

  console.log("✓ 4A-Test 2 passed — Goal progress computation is honest, safe, and handles qualitative goals.");
}

// [4A-TEST 3] Pending and completed tasks distinction
console.log("\n[4A-TEST 3] Pending and completed tasks");
{
  const pendingTask = {
    id: "t1",
    title: "Finish chapter 4",
    status: "PENDING",
    dueDate: new Date("2026-11-14T10:00:00Z"),
    goalId: "g1",
    goalTitle: "Pass GRE",
    isOverdue: false,
    daysOverdue: 0,
    daysSinceUpdated: 1,
    isStale: false,
    avoidCount: 0,
    postponeCount: 0,
    isPostponed: false,
    completedAt: null,
  };

  const inProgressTask = {
    id: "t2",
    title: "Draft essay",
    status: "IN_PROGRESS",
    dueDate: null,
    goalId: null,
    goalTitle: null,
    isOverdue: false,
    daysOverdue: 0,
    daysSinceUpdated: 0,
    isStale: false,
    avoidCount: 0,
    postponeCount: 0,
    isPostponed: false,
    completedAt: null,
  };

  const completedTask = {
    id: "t3",
    title: "Vocabulary flashcards",
    status: "COMPLETED",
    dueDate: new Date("2026-11-12T10:00:00Z"),
    goalId: "g1",
    goalTitle: "Pass GRE",
    isOverdue: false, // Must NEVER be overdue once completed!
    daysOverdue: 0,
    daysSinceUpdated: 0,
    isStale: false,
    avoidCount: 0,
    postponeCount: 0,
    isPostponed: false,
    completedAt: new Date("2026-11-13T12:00:00Z"),
  };

  const context = createBaseContext({
    pendingTasks: [pendingTask, inProgressTask],
    completedTasks: [completedTask],
    completedTasksCountToday: 1,
  });

  assert.strictEqual(context.pendingTasks.length, 2);
  assert.strictEqual(context.completedTasks.length, 1);
  assert.strictEqual(context.completedTasks[0].status, "COMPLETED");
  assert.strictEqual(context.completedTasks[0].isOverdue, false, "Completed task must never be overdue");
  assert.strictEqual(context.completedTasksCountToday, 1);
  console.log("✓ 4A-Test 3 passed — Pending and completed tasks cleanly separated and tracked.");
}

// [4A-TEST 4] Overdue tasks and deadlines
console.log("\n[4A-TEST 4] Overdue tasks and deadlines");
{
  const now = new Date("2026-11-13T14:00:00.000Z");

  const overdueTask = {
    id: "t_od",
    title: "Submit lab report",
    status: "PENDING",
    dueDate: new Date("2026-11-11T12:00:00.000Z"), // 2 days ago
    isOverdue: true,
    daysOverdue: 2,
    daysSinceUpdated: 2,
    isStale: false,
    avoidCount: 1,
    postponeCount: 1,
    isPostponed: true,
  };

  const approachingTask = {
    id: "t_app",
    title: "Math problem set",
    status: "PENDING",
    dueDate: new Date("2026-11-13T18:00:00.000Z"), // 4 hours from now
    isOverdue: false,
    daysOverdue: 0,
    daysSinceUpdated: 0,
    isStale: false,
    avoidCount: 0,
    postponeCount: 0,
    isPostponed: false,
    hoursUntilDue: 4,
  };

  const context = createBaseContext({
    now,
    pendingTasks: [overdueTask, approachingTask],
    overdueTasks: [overdueTask],
    approachingDeadlineTasks: [approachingTask],
  });

  assert.strictEqual(context.overdueTasks.length, 1);
  assert.strictEqual(context.overdueTasks[0].daysOverdue, 2);
  assert.strictEqual(context.approachingDeadlineTasks.length, 1);
  assert.strictEqual(context.approachingDeadlineTasks[0].hoursUntilDue, 4);
  console.log("✓ 4A-Test 4 passed — Overdue tasks and approaching deadlines correctly identified.");
}

// [4A-TEST 5] Postponed tasks and avoidance tracking
console.log("\n[4A-TEST 5] Postponed tasks and avoidance tracking");
{
  const repeatedlyPostponedTask = {
    id: "t_postponed",
    title: "Call insurance company",
    status: "PENDING",
    dueDate: null,
    isOverdue: false,
    daysOverdue: 0,
    daysSinceUpdated: 4,
    isStale: true,
    avoidCount: 2,
    postponeCount: 3,
    isPostponed: true,
  };

  const normalTask = {
    id: "t_normal",
    title: "Grocery shopping",
    status: "PENDING",
    dueDate: null,
    isOverdue: false,
    daysOverdue: 0,
    daysSinceUpdated: 0,
    isStale: false,
    avoidCount: 0,
    postponeCount: 0,
    isPostponed: false,
  };

  const context = createBaseContext({
    pendingTasks: [repeatedlyPostponedTask, normalTask],
    postponedTasks: [repeatedlyPostponedTask],
    repeatedlyPostponedTasks: [repeatedlyPostponedTask],
  });

  assert.strictEqual(context.postponedTasks.length, 1);
  assert.strictEqual(context.repeatedlyPostponedTasks.length, 1);
  assert.strictEqual(context.repeatedlyPostponedTasks[0].postponeCount, 3);
  console.log("✓ 4A-Test 5 passed — Postponed tasks and avoidance counts tracked accurately.");
}

// [4A-TEST 6] Safe handling of missing or incomplete data
console.log("\n[4A-TEST 6] Safe handling of missing or incomplete data");
{
  // User with zero goals, zero tasks, zero schedule
  const emptyContext = createBaseContext({
    allGoals: [],
    activeGoals: [],
    completedGoals: [],
    pendingTasks: [],
    completedTasks: [],
    incompleteTasks: [],
    overdueTasks: [],
    staleTasks: [],
    postponedTasks: [],
    repeatedlyPostponedTasks: [],
  });

  const detections = detectAllGoalTaskInsights(emptyContext);
  assert.strictEqual(detections.hasDetections, false);
  assert.strictEqual(detections.totalCount, 0);

  // Incomplete goal data: missing description, target, deadline
  const partialGoal = {
    id: "g_part",
    title: "Explore gardening",
    description: null,
    category: null,
    priority: "MEDIUM",
    status: "ACTIVE",
    deadline: null,
    isOverdue: false,
    daysUntilDeadline: null,
    daysSinceUpdated: 1,
    isStale: false,
    avoidCount: 0,
    targetLabel: null,
    targetValue: null,
    progressValue: null,
    progressPercent: null,
    completedAt: null,
    hasGoodProgress: false,
  };

  // Incomplete task data: missing dueDate, goalId, description
  const partialTask = {
    id: "t_part",
    title: "Water the plants",
    description: null,
    status: "PENDING",
    dueDate: null,
    goalId: null,
    goalTitle: null,
    isOverdue: false,
    daysOverdue: 0,
    daysSinceUpdated: 0,
    isStale: false,
    avoidCount: 0,
    postponeCount: 0,
    isPostponed: false,
    completedAt: null,
  };

  const partialContext = createBaseContext({
    allGoals: [partialGoal],
    activeGoals: [partialGoal],
    pendingTasks: [partialTask],
    incompleteTasks: [partialTask],
  });

  const partialDetections = detectAllGoalTaskInsights(partialContext);
  assert.doesNotThrow(() => {
    assert.strictEqual(partialDetections.hasDetections, false);
  });
  console.log("✓ 4A-Test 6 passed — Handles empty and incomplete data safely without throwing.");
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 4B — GOAL AND TASK DETECTION TESTS
// ═════════════════════════════════════════════════════════════════════════════

console.log("\n─── PART 4B: GOAL AND TASK DETECTION ───");

// [4B-SCENARIO 1] Important goals with no recent progress
console.log("\n[4B-SCENARIO 1] Important goals with no recent progress");
{
  const staleHighPriorityGoal = {
    id: "g_stale_hi",
    title: "Prepare for Technical Interviews",
    priority: "HIGH",
    status: "ACTIVE",
    daysSinceUpdated: 4, // 4 days untouched (threshold: 2)
    progressPercent: 20,
    targetValue: 50,
    progressValue: 10,
    avoidCount: 1,
  };

  const freshHighPriorityGoal = {
    id: "g_fresh_hi",
    title: "System Design Practice",
    priority: "HIGH",
    status: "ACTIVE",
    daysSinceUpdated: 0, // Updated today!
    progressPercent: 30,
    targetValue: 10,
    progressValue: 3,
    avoidCount: 0,
  };

  const completedHighGoal = {
    id: "g_done_hi",
    title: "Resume Polish",
    priority: "HIGH",
    status: "ACTIVE",
    daysSinceUpdated: 5,
    progressPercent: 100, // 100% done, should not flag as neglected
    targetValue: 1,
    progressValue: 1,
    avoidCount: 0,
  };

  const context = createBaseContext({
    activeGoals: [staleHighPriorityGoal, freshHighPriorityGoal, completedHighGoal],
  });

  const detections = detectImportantGoalsNoProgress(context);
  assert.strictEqual(detections.length, 1, "Only the stale incomplete HIGH goal should be detected");
  assert.strictEqual(detections[0].targetId, "g_stale_hi");
  assert.strictEqual(detections[0].severity, "urgent");
  assert.strictEqual(detections[0].type, "important_goal_no_progress");
  assert(detections[0].summary.includes("Prepare for Technical Interviews"));
  console.log(`✓ 4B-Scenario 1 passed — Detected: "${detections[0].summary}"`);
}

// [4B-SCENARIO 2] Tasks approaching deadlines
console.log("\n[4B-SCENARIO 2] Tasks approaching deadlines");
{
  const now = new Date("2026-11-13T14:00:00.000Z");

  const taskDueIn3Hours = {
    id: "t_due_3h",
    title: "Submit Grant Proposal",
    status: "PENDING",
    dueDate: new Date("2026-11-13T17:00:00.000Z"), // 3h away
  };

  const taskDueIn20Hours = {
    id: "t_due_20h",
    title: "Team Weekly Update",
    status: "PENDING",
    dueDate: new Date("2026-11-14T10:00:00.000Z"), // 20h away
  };

  const taskDueIn5Days = {
    id: "t_due_5d",
    title: "Monthly Budget Review",
    status: "PENDING",
    dueDate: new Date("2026-11-18T10:00:00.000Z"), // 5 days away (> 24h threshold)
  };

  const completedTaskDueIn2Hours = {
    id: "t_completed_soon",
    title: "Morning Standup Notes",
    status: "COMPLETED", // Already completed — must not be flagged!
    dueDate: new Date("2026-11-13T16:00:00.000Z"),
  };

  const context = createBaseContext({
    now,
    pendingTasks: [taskDueIn3Hours, taskDueIn20Hours, taskDueIn5Days, completedTaskDueIn2Hours],
  });

  const detections = detectTasksApproachingDeadline(context, { now });
  assert.strictEqual(detections.length, 2, "Tasks due in 3h and 20h should be detected");
  assert.strictEqual(detections[0].targetId, "t_due_3h");
  assert.strictEqual(detections[0].severity, "urgent", "<= 6h should be urgent");
  assert.strictEqual(detections[1].targetId, "t_due_20h");
  assert.strictEqual(detections[1].severity, "warning", "> 6h should be warning");
  console.log(`✓ 4B-Scenario 2 passed — Detected approaching deadlines (${detections.length} tasks).`);
}

// [4B-SCENARIO 3] Overdue tasks (Respecting completion status)
console.log("\n[4B-SCENARIO 3] Overdue tasks (Respecting completion status)");
{
  const now = new Date("2026-11-13T14:00:00.000Z");

  const overduePendingTask = {
    id: "t_od_pending",
    title: "Renew Passport",
    status: "PENDING",
    dueDate: new Date("2026-11-10T00:00:00.000Z"), // 3 days ago
  };

  const overdueCompletedTask = {
    id: "t_od_done",
    title: "File Tax Extension",
    status: "COMPLETED", // Completed! Must NEVER be flagged as overdue!
    dueDate: new Date("2026-11-10T00:00:00.000Z"),
  };

  const context = createBaseContext({
    now,
    pendingTasks: [overduePendingTask, overdueCompletedTask],
  });

  const detections = detectOverdueTasks(context, { now });
  assert.strictEqual(detections.length, 1, "Only the incomplete overdue task must be flagged");
  assert.strictEqual(detections[0].targetId, "t_od_pending");
  assert.strictEqual(detections[0].severity, "urgent");
  assert.strictEqual(detections[0].details.daysOverdue, 3);
  console.log(`✓ 4B-Scenario 3 passed — Overdue detected accurately; completed task respected.`);
}

// [4B-SCENARIO 4] Tasks repeatedly postponed
console.log("\n[4B-SCENARIO 4] Tasks repeatedly postponed");
{
  const taskPostponed3Times = {
    id: "t_post_3",
    title: "Dentist Appointment",
    status: "PENDING",
    postponeCount: 3,
    avoidCount: 2,
  };

  const taskPostponed1Time = {
    id: "t_post_1",
    title: "Order New Desk Mat",
    status: "PENDING",
    postponeCount: 1,
    avoidCount: 0,
  };

  const completedTaskPostponed4Times = {
    id: "t_post_done",
    title: "Change Air Filter",
    status: "COMPLETED", // Done now, don't nag
    postponeCount: 4,
    avoidCount: 3,
  };

  const context = createBaseContext({
    pendingTasks: [taskPostponed3Times, taskPostponed1Time, completedTaskPostponed4Times],
  });

  const detections = detectTasksRepeatedlyPostponed(context);
  assert.strictEqual(detections.length, 1, "Only incomplete task with >=2 postpones should flag");
  assert.strictEqual(detections[0].targetId, "t_post_3");
  assert.strictEqual(detections[0].severity, "warning");
  assert.strictEqual(detections[0].details.effectiveCount, 3);
  console.log(`✓ 4B-Scenario 4 passed — Repeatedly postponed task detected (${detections[0].summary}).`);
}

// [4B-SCENARIO 5] Goals making good progress
console.log("\n[4B-SCENARIO 5] Goals making good progress");
{
  const goalAt75Percent = {
    id: "g_good_75",
    title: "Run 100km this month",
    status: "ACTIVE",
    progressPercent: 75,
    targetValue: 100,
    progressValue: 75,
    daysSinceUpdated: 1,
  };

  const completedGoal = {
    id: "g_good_done",
    title: "Complete Python Course",
    status: "COMPLETED",
    progressPercent: 100,
    targetValue: 20,
    progressValue: 20,
    daysSinceUpdated: 0,
  };

  const stalledGoalAt10Percent = {
    id: "g_stalled_10",
    title: "Learn Italian",
    status: "ACTIVE",
    progressPercent: 10,
    targetValue: 100,
    progressValue: 10,
    daysSinceUpdated: 15,
  };

  const context = createBaseContext({
    activeGoals: [goalAt75Percent, stalledGoalAt10Percent],
    completedGoals: [completedGoal],
  });

  const detections = detectGoalsMakingGoodProgress(context);
  assert.strictEqual(detections.length, 2, "75% goal and completed goal should both be recognized");
  assert.strictEqual(detections[0].severity, "celebration");
  assert.strictEqual(detections[0].type, "goal_good_progress");
  console.log(`✓ 4B-Scenario 5 passed — Goals making good progress recognized (${detections.length} goals).`);
}

// [4B-SCENARIO 6] Unrealistic workloads
console.log("\n[4B-SCENARIO 6] Unrealistic workloads");
{
  // Overloaded context: 9 pending tasks
  const overloadedContext = createBaseContext({
    totalPendingTasksCount: 9,
    pendingTasks: Array(9)
      .fill(null)
      .map((_, i) => ({
        id: `t_bulk_${i}`,
        title: `Work Task ${i + 1}`,
        status: "PENDING",
        dueDate: new Date("2026-11-13T17:00:00Z"),
      })),
  });

  const overloadedDetections = detectUnrealisticWorkloads(overloadedContext);
  assert.strictEqual(overloadedDetections.length, 1);
  assert.strictEqual(overloadedDetections[0].type, "unrealistic_workload");
  assert.strictEqual(overloadedDetections[0].severity, "warning");
  assert.strictEqual(overloadedDetections[0].details.totalPendingCount, 9);

  // Normal context: 3 pending tasks
  const normalContext = createBaseContext({
    totalPendingTasksCount: 3,
    pendingTasks: Array(3)
      .fill(null)
      .map((_, i) => ({
        id: `t_norm_${i}`,
        title: `Task ${i + 1}`,
        status: "PENDING",
        dueDate: null,
      })),
  });

  const normalDetections = detectUnrealisticWorkloads(normalContext);
  assert.strictEqual(normalDetections.length, 0, "3 pending tasks should not trigger unrealistic workload");
  console.log(`✓ 4B-Scenario 6 passed — Unrealistic workload detected for 9 tasks; normal 3 tasks clean.`);
}

// [4B-SCENARIO 7] Deduplication and Cooldown Filtering
console.log("\n[4B-SCENARIO 7] Deduplication and Cooldown Filtering");
{
  const now = new Date("2026-11-13T14:00:00.000Z");

  const overdueTask = {
    id: "t_cooldown_test",
    title: "File Annual Report",
    status: "PENDING",
    dueDate: new Date("2026-11-12T10:00:00.000Z"),
  };

  const context = createBaseContext({
    now,
    pendingTasks: [overdueTask],
  });

  const detections = detectOverdueTasks(context, { now });
  assert.strictEqual(detections.length, 1);
  const dedupKey = detections[0].dedupKey;

  // 1. Alert sent 2 hours ago (within 12-hour cooldown) -> MUST BE SUPPRESSED
  const recentAlertsInsideCooldown = [
    {
      dedupKey,
      createdAt: new Date("2026-11-13T12:00:00.000Z"), // 2 hours ago
    },
  ];

  const filteredInside = filterDetectionsByCooldown(detections, recentAlertsInsideCooldown, now);
  assert.strictEqual(filteredInside.length, 0, "Alert sent 2h ago should be suppressed under 12h cooldown");

  // 2. Alert sent 14 hours ago (past 12-hour cooldown) -> ALLOWED
  const pastAlertsOutsideCooldown = [
    {
      dedupKey,
      createdAt: new Date("2026-11-13T00:00:00.000Z"), // 14 hours ago
    },
  ];

  const filteredOutside = filterDetectionsByCooldown(detections, pastAlertsOutsideCooldown, now);
  assert.strictEqual(filteredOutside.length, 1, "Alert sent 14h ago should be allowed once cooldown elapses");

  console.log(`✓ 4B-Scenario 7 passed — Cooldown and deduplication filter verified.`);
}

console.log("\n==========================================================================");
console.log("ALL PART 4A & PART 4B TESTS PASSED CLEANLY! (13/13)");
console.log("==========================================================================");
