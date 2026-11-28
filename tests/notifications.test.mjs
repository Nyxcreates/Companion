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
    if (id.startsWith("./")) {
      const candidate = path.resolve(path.dirname(fullPath), `${id}.ts`);
      return loadTsModule(path.relative(rootDir, candidate));
    }
    return require(id);
  };
  const fn = new Function("exports", "require", "module", "__filename", "__dirname", outputText);
  fn(mod.exports, customRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const { getTimeOfDayGreeting, normalizeGreetingForHour } = loadTsModule("src/lib/nikki/greeting.ts");
const { decideNikkiNudge } = loadTsModule("src/lib/nikki/decide.ts");
const { signNudgeActionToken, verifyNudgeActionToken } = loadTsModule("src/lib/nikki/actionToken.ts");

function makeBaseContext(overrides = {}) {
  return {
    firebaseUid: "user-123",
    userName: "Nishtha",
    companionName: "Nikki",
    timezone: "Asia/Calcutta",
    localTime: "09:00",
    localDate: "2026-11-28",
    currentHour: 9,
    currentMinute: 0,
    totalMinutes: 9 * 60,
    quietHoursStart: "22:30",
    quietHoursEnd: "07:00",
    isQuietHours: false,
    morningCheckInEnabled: true,
    morningCheckInTime: "08:00",
    eveningCheckInEnabled: true,
    eveningCheckInTime: "20:00",
    isPaused: false,
    pausedUntil: null,
    proactiveEnabled: true,
    strictness: "playful",
    checkInFrequency: "balanced",
    sleepReminderEnabled: true,
    sleepReminderSnoozeMinutes: 25,
    sleepSnoozeUntil: null,
    sleepDismissedForDate: null,
    studyRemindersEnabled: true,
    hobbyRemindersEnabled: true,
    isUserExhausted: false,
    upcomingActivities: [],
    hobbyCandidates: [],
    hasScheduleToday: true,
    scheduleItems: [{ title: "Deep Work", start: "09:00", end: "11:00", type: "study", status: "pending" }],
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
    lastSeenAt: null,
    minutesSinceLastSeen: null,
    isFirstOpenOfDay: false,
    isReturningAfterAbsence: false,
    isLongContinuousSession: false,
    usualBedtime: "23:00",
    usualWakeTime: "07:30",
    ...overrides,
  };
}

test("same trigger does not fire twice in cooldown window and enforces >=10m global gap", () => {
  const ctx1 = makeBaseContext();
  const d1 = decideNikkiNudge(ctx1);
  assert.equal(d1.shouldSpeak, true);
  assert.equal(d1.trigger, "morning_plan");

  // 2 minutes later: global min gap blocks any nudge (even if minGapMinutes=1 is passed, floor is 10m)
  const twoMinsAgo = new Date(Date.now() - 2 * 60_000);
  const ctx2 = makeBaseContext({
    lastNudge: {
      id: "n1",
      trigger: "morning_plan",
      message: "Good morning!",
      status: "delivered",
      idempotencyKey: d1.idempotencyKey,
      createdAt: twoMinsAgo,
    },
    recentNudgesToday: [
      {
        id: "n1",
        trigger: "morning_plan",
        message: "Good morning!",
        status: "delivered",
        idempotencyKey: d1.idempotencyKey,
        createdAt: twoMinsAgo,
      },
    ],
    nudgesSentTodayCount: 1,
  });

  const d2 = decideNikkiNudge(ctx2, { minGapMinutes: 1 });
  assert.equal(d2.shouldSpeak, false);
  assert.match(d2.reason, /Minimum gap/);
});

test("Done status blocks refiring the same trigger in its cooldown window", () => {
  const twoHoursAgo = new Date(Date.now() - 120 * 60_000);
  const ctx = makeBaseContext({
    lastNudge: {
      id: "n-other",
      trigger: "general_checkin",
      message: "Hey!",
      status: "done",
      idempotencyKey: "user-123:general_checkin:2026-11-28",
      createdAt: twoHoursAgo,
    },
    recentNudgesToday: [
      {
        id: "n-morning",
        trigger: "morning_plan",
        message: "Good morning!",
        status: "done",
        idempotencyKey: "user-123:morning_plan:2026-11-28",
        createdAt: twoHoursAgo,
      },
    ],
    nudgesSentTodayCount: 2,
  });

  const decision = decideNikkiNudge(ctx);
  assert.notEqual(decision.trigger, "morning_plan");
});

test("snooze delays firing until snooze time has elapsed", () => {
  const futureSnooze = new Date(Date.now() + 15 * 60_000);
  const ctxBefore = makeBaseContext({
    currentHour: 23,
    currentMinute: 10,
    totalMinutes: 23 * 60 + 10,
    localTime: "23:10",
    sleepSnoozeUntil: futureSnooze,
  });
  const beforeDecision = decideNikkiNudge(ctxBefore);
  assert.equal(beforeDecision.shouldSpeak, false);

  const pastSnooze = new Date(Date.now() - 1000);
  const ctxAfter = makeBaseContext({
    currentHour: 23,
    currentMinute: 10,
    totalMinutes: 23 * 60 + 10,
    localTime: "23:10",
    sleepSnoozeUntil: pastSnooze,
  });
  const afterDecision = decideNikkiNudge(ctxAfter);
  assert.equal(afterDecision.shouldSpeak, true);
  assert.equal(afterDecision.trigger, "sleep_reminder");
});

test("timezone greetings match local hour (morning < 12, afternoon 12-17, evening >= 17)", () => {
  assert.equal(getTimeOfDayGreeting(8), "Good morning");
  assert.equal(getTimeOfDayGreeting(11), "Good morning");
  assert.equal(getTimeOfDayGreeting(12), "Good afternoon");
  assert.equal(getTimeOfDayGreeting(16), "Good afternoon");
  assert.equal(getTimeOfDayGreeting(17), "Good evening");
  assert.equal(getTimeOfDayGreeting(22), "Good evening");

  assert.equal(
    normalizeGreetingForHour("Good morning, Nishtha! Have some water.", 15),
    "Good afternoon, Nishtha! Have some water."
  );
  assert.equal(
    normalizeGreetingForHour("Good morning, Nishtha! Have some water.", 18),
    "Good evening, Nishtha! Have some water."
  );
  assert.equal(
    normalizeGreetingForHour("Good morning, Nishtha! Have some water.", 9),
    "Good morning, Nishtha! Have some water."
  );
});

test("signed action token validates owner-scoped Done/Snooze and rejects tampering", () => {
  const token = signNudgeActionToken({
    uid: "user-123",
    nudgeId: "nudge-abc",
    trigger: "morning_plan",
    action: "done",
  });
  const verified = verifyNudgeActionToken(token);
  assert.ok(verified);
  assert.equal(verified.uid, "user-123");
  assert.equal(verified.nudgeId, "nudge-abc");
  assert.equal(verified.action, "done");

  const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  assert.equal(verifyNudgeActionToken(tampered), null);
});
