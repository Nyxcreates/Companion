import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTsModule(relPath) {
  const fullPath = path.join(rootDir, relPath);
  const source = readFileSync(fullPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: fullPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const customRequire = (id) => {
    if (id === "./reminderPolicy") {
      return loadTsModule("src/lib/nikki/reminderPolicy.ts");
    }
    return require(id);
  };
  const fn = new Function("exports", "require", "module", "__filename", "__dirname", outputText);
  fn(mod.exports, customRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const policy = loadTsModule("src/lib/nikki/reminderPolicy.ts");
const { decideNikkiNudge } = loadTsModule("src/lib/nikki/decide.ts");
const { LocalSessionMonitor } = require(path.join(rootDir, "desktop", "sessionMonitor.js"));

function makeBaseContext(overrides = {}) {
  return {
    firebaseUid: "user-123",
    userName: "Nishtha",
    companionName: "Nikki",
    timezone: "Asia/Calcutta",
    localTime: "21:35",
    localDate: "2026-11-28",
    currentHour: 21,
    currentMinute: 35,
    totalMinutes: 21 * 60 + 35,
    quietHoursStart: "22:30",
    quietHoursEnd: "07:00",
    isQuietHours: false,
    morningCheckInEnabled: false,
    morningCheckInTime: "08:00",
    eveningCheckInEnabled: false,
    eveningCheckInTime: "20:00",
    isPaused: false,
    pausedUntil: null,
    proactiveEnabled: true,
    strictness: "playful",
    checkInFrequency: "balanced",
    sleepReminderEnabled: false,
    sleepReminderSnoozeMinutes: 25,
    sleepSnoozeUntil: null,
    sleepDismissedForDate: null,
    studyRemindersEnabled: true,
    hobbyRemindersEnabled: true,
    isUserExhausted: false,
    upcomingActivities: [],
    hobbyCandidates: [],
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
    lastUserMessageAt: null,
    minutesSinceLastUserMessage: null,
    lastConversationTopic: null,
    memories: [],
    lastFocusSession: null,
    isFocusSessionJustFinished: false,
    activeFocusSession: null,
    recentJournalEntry: null,
    lastNudge: null,
    recentNudgesToday: [],
    recentNudgeOutcomes: [],
    consecutiveIgnoredOrDismissedNudges: 0,
    nudgesSentTodayCount: 0,
    recentMoods: [],
    hydrationCountToday: 0,
    breakCountToday: 0,
    lastSeenAt: new Date(),
    minutesSinceLastSeen: 5,
    isFirstOpenOfDay: false,
    isReturningAfterAbsence: false,
    isLongContinuousSession: false,
    usualBedtime: "23:00",
    usualWakeTime: "07:30",
    ...overrides,
  };
}

test("computeSnoozeUntil delays by exact 10 or 15 minutes", () => {
  const base = 1_700_000_000_000;
  assert.equal(policy.computeSnoozeUntil(base, 10).getTime(), base + 10 * 60_000);
  assert.equal(policy.computeSnoozeUntil(base, 15).getTime(), base + 15 * 60_000);
});

test("evaluateTimetableItemEligibility blocks before snooze expires and allows at expiry", () => {
  const now = 1_700_000_000_000;
  const snoozedUntilMs = now + 10 * 60_000;

  const before = policy.evaluateTimetableItemEligibility({
    status: "later",
    remindersSentCount: 1,
    snoozedUntilMs,
    nowMs: now + 9 * 60_000,
  });
  assert.equal(before.eligible, false);
  assert.equal(before.reason, "snoozed");

  const atExpiry = policy.evaluateTimetableItemEligibility({
    status: "later",
    remindersSentCount: 1,
    snoozedUntilMs,
    nowMs: snoozedUntilMs,
  });
  assert.equal(atExpiry.eligible, true);
  assert.equal(atExpiry.nextAttempt, 2);
});

test("evaluateTimetableItemEligibility stops after started, done, or skipped", () => {
  const now = 1_700_000_000_000;
  for (const status of ["started", "done", "skipped"]) {
    const res = policy.evaluateTimetableItemEligibility({
      status,
      remindersSentCount: 0,
      nowMs: now,
    });
    assert.equal(res.eligible, false, `Expected ${status} to stop reminders`);
    assert.equal(res.reason, "terminal_status");
  }
});

test("evaluateTimetableItemEligibility caps at 3 reminders per item", () => {
  const now = 1_700_000_000_000;
  const third = policy.evaluateTimetableItemEligibility({
    status: "pending",
    remindersSentCount: 2,
    nowMs: now,
  });
  assert.equal(third.eligible, true);
  assert.equal(third.nextAttempt, 3);

  const fourth = policy.evaluateTimetableItemEligibility({
    status: "pending",
    remindersSentCount: 3,
    nowMs: now,
  });
  assert.equal(fourth.eligible, false);
  assert.equal(fourth.reason, "cap_reached");
});

test("minimum 10-minute gap enforced between any two unprompted messages", () => {
  const now = 1_700_000_000_000;
  const tooSoon = policy.evaluateTimetableItemEligibility({
    status: "pending",
    remindersSentCount: 0,
    lastGlobalNudgeAtMs: now - 9 * 60_000,
    nowMs: now,
  });
  assert.equal(tooSoon.eligible, false);
  assert.equal(tooSoon.reason, "min_gap");

  const ok = policy.evaluateTimetableItemEligibility({
    status: "pending",
    remindersSentCount: 0,
    lastGlobalNudgeAtMs: now - 10 * 60_000,
    nowMs: now,
  });
  assert.equal(ok.eligible, true);
});

test("decideNikkiNudge generates stable per-item/day/attempt key and dedupes", () => {
  const item = {
    title: "Deep Study: Algorithms",
    start: "21:30",
    end: "22:30",
    minutesSinceStart: 5,
    scheduleId: "sched-1",
    itemIndex: 0,
    uniqueKey: "sched-1_0",
    status: "pending",
    remindersSentCount: 0,
    snoozedUntil: null,
  };

  const ctx1 = makeBaseContext({ unstartedStartedItems: [item] });
  const d1 = decideNikkiNudge(ctx1);
  assert.equal(d1.shouldSpeak, true);
  assert.equal(d1.trigger, "timetable_unstarted");
  assert.equal(d1.idempotencyKey, "user-123:timetable_unstarted:2026-11-28:sched-1_0:r1");

  // Same key already in recentNudgesToday must not fire again
  const ctx2 = makeBaseContext({
    unstartedStartedItems: [item],
    recentNudgesToday: [
      {
        id: "n1",
        trigger: "timetable_unstarted",
        message: "...",
        status: "delivered",
        idempotencyKey: d1.idempotencyKey,
        createdAt: new Date(Date.now() - 20 * 60_000),
      },
    ],
  });
  const d2 = decideNikkiNudge(ctx2);
  assert.equal(d2.shouldSpeak, false);
});

test("overdue goals fire at most once per day and respect dismissal", () => {
  const now = 1_700_000_000_000;
  assert.equal(
    policy.evaluateOverdueGoalEligibility({ alreadySentToday: true, nowMs: now }).eligible,
    false
  );
  assert.equal(
    policy.evaluateOverdueGoalEligibility({ alreadySentToday: false, dismissedToday: true, nowMs: now }).eligible,
    false
  );
  assert.equal(
    policy.evaluateOverdueGoalEligibility({ alreadySentToday: false, nowMs: now }).eligible,
    true
  );

  const ctx = makeBaseContext({
    overdueGoals: [
      {
        id: "goal-1",
        title: "Finish Algorithms Course",
        description: null,
        category: "study",
        priority: "HIGH",
        status: "ACTIVE",
        deadline: new Date(Date.now() - 86400_000),
        isOverdue: true,
        daysUntilDeadline: -1,
        daysSinceUpdated: 2,
        isStale: false,
        avoidCount: 0,
        targetLabel: null,
        targetValue: null,
        progressValue: null,
        progressPercent: null,
        completedAt: null,
        hasGoodProgress: false,
      },
    ],
  });
  const decision = decideNikkiNudge(ctx);
  assert.equal(decision.shouldSpeak, true);
  assert.equal(decision.trigger, "goal_neglected");
  assert.equal(decision.triggerContext?.isOverdueGoal, true);
  assert.equal(decision.idempotencyKey, "user-123:goal_overdue:goal-1:2026-11-28");
});

test("LocalSessionMonitor is off by default, resets on idle, and triggers after interval", () => {
  let idleSec = 0;
  let enabled = false;
  let triggered = 0;

  const mon = new LocalSessionMonitor({
    getSystemIdleTime: () => idleSec,
    getConfig: () => ({ enabled, intervalMinutes: 15 }),
    canTrigger: () => true,
    onThresholdReached: () => {
      triggered++;
    },
  });

  // Off by default -> never increments or triggers
  mon.tick(1000);
  assert.equal(mon.activeSeconds, 0);
  assert.equal(triggered, 0);

  // Enable and tick 14 active minutes
  enabled = true;
  for (let i = 0; i < 14; i++) {
    mon.tick(1000 + i * 60_000);
  }
  assert.equal(triggered, 0);

  // Idle >= 300s resets continuous active counter
  idleSec = 300;
  mon.tick(2_000_000);
  assert.equal(mon.activeSeconds, 0);

  // Resume active for 15 minutes -> triggers once
  idleSec = 10;
  for (let i = 0; i < 15; i++) {
    mon.tick(3_000_000 + i * 60_000);
  }
  assert.equal(triggered, 1);
  assert.equal(mon.activeSeconds, 0);
});
