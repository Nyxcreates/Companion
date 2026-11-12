import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { decideNikkiNudge } from "../src/lib/nikki/decide.ts";

console.log("==========================================================");
console.log("TEST SUITE: NIKKI BRAIN DECISION ENGINE (decide.ts)");
console.log("==========================================================");

/** Helper to generate a baseline context snapshot */
function createBaseContext(overrides = {}) {
  return {
    firebaseUid: "user_test_123",
    userName: "Nishtha",
    companionName: "Nikki",
    timezone: "Asia/Kolkata",
    localTime: "10:00",
    localDate: "2026-11-13",
    currentHour: 10,
    currentMinute: 0,
    totalMinutes: 10 * 60,

    quietHoursStart: "22:30",
    quietHoursEnd: "07:00",
    isQuietHours: false,
    isPaused: false,
    pausedUntil: null,
    proactiveEnabled: true,
    strictness: "playful",

    hasScheduleToday: true,
    scheduleItems: [],
    unstartedStartedItems: [],

    activeGoals: [],
    overdueGoals: [],
    staleGoals: [],
    incompleteTasks: [],
    overdueTasks: [],
    staleTasks: [],

    lastUserMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    minutesSinceLastUserMessage: 120,
    lastNudge: null,
    recentNudgeOutcomes: [],
    consecutiveIgnoredOrDismissedNudges: 0,
    nudgesSentTodayCount: 0,

    recentMoods: [],
    hydrationCountToday: 1,
    breakCountToday: 1,

    lastSeenAt: new Date(Date.now() - 10 * 60 * 1000),
    minutesSinceLastSeen: 10,
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
    nudgesSentTodayCount: 3,
    unstartedStartedItems: [
      { title: "Study DCCN", start: "09:30", end: "10:30", minutesSinceStart: 30 },
    ],
  });
  const decision = decideNikkiNudge(context, { maxDailyNudges: 3 });
  assert.strictEqual(decision.shouldSpeak, false);
  assert.ok(decision.reason.includes("Daily limit"));
  console.log("✓ Enforces max daily unprompted message cap (e.g. 3/day)");
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

// ── TEST 7: Trigger 1 — timetable_unstarted ────────────────────────────────
console.log("\n[TEST 7] Trigger: timetable_unstarted");
{
  const context = createBaseContext({
    unstartedStartedItems: [
      { title: "Lab Prep", start: "09:40", end: "10:40", minutesSinceStart: 20 },
    ],
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "timetable_unstarted");
  assert.strictEqual(decision.idempotencyKey, "user_test_123:timetable_unstarted:2026-11-13:09:40");
  assert.strictEqual(decision.triggerContext.itemTitle, "Lab Prep");
  console.log("✓ Fires timetable_unstarted when scheduled item started and not marked started");
}

// ── TEST 8: Trigger 2 — morning_plan (hydrate and plan) ────────────────────
console.log("\n[TEST 8] Trigger: morning_plan");
{
  const context = createBaseContext({
    currentHour: 8,
    currentMinute: 0,
    totalMinutes: 8 * 60,
    usualWakeTime: "07:30",
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "morning_plan");
  assert.strictEqual(decision.idempotencyKey, "user_test_123:morning_plan:2026-11-13");
  console.log("✓ Fires morning_plan during morning window after wake time");
}

// ── TEST 9: Trigger 3 — no_timetable ───────────────────────────────────────
console.log("\n[TEST 9] Trigger: no_timetable");
{
  const context = createBaseContext({
    hasScheduleToday: false,
    currentHour: 11,
    currentMinute: 0,
    totalMinutes: 11 * 60,
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "no_timetable");
  assert.strictEqual(decision.idempotencyKey, "user_test_123:no_timetable:2026-11-13");
  console.log("✓ Fires no_timetable when daytime has started and schedule is missing");
}

// ── TEST 10: Trigger 4 — mood_followup ─────────────────────────────────────
console.log("\n[TEST 10] Trigger: mood_followup");
{
  const context = createBaseContext({
    currentHour: 15,
    currentMinute: 0,
    totalMinutes: 15 * 60,
    recentMoods: [
      {
        emotion: "stressed",
        intensity: 0.8,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
    ],
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "mood_followup");
  assert.strictEqual(decision.triggerContext.emotion, "stressed");
  console.log("✓ Fires mood_followup after a recent distressed emotion reading");
}

// ── TEST 11: Trigger 5 — late_night ────────────────────────────────────────
console.log("\n[TEST 11] Trigger: late_night");
{
  const context = createBaseContext({
    currentHour: 23,
    currentMinute: 45,
    totalMinutes: 23 * 60 + 45,
    usualBedtime: "23:00",
    minutesSinceLastSeen: 15, // Active recently
    isQuietHours: false, // Late night evaluation before quiet cutoff or during check
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "late_night");
  assert.strictEqual(decision.idempotencyKey, "user_test_123:late_night:2026-11-13");
  console.log("✓ Fires late_night when user is awake and active past usual bedtime");
}

// ── TEST 12: Trigger 6 — long_session ──────────────────────────────────────
console.log("\n[TEST 12] Trigger: long_session");
{
  const context = createBaseContext({
    currentHour: 16,
    currentMinute: 0,
    totalMinutes: 16 * 60,
    isLongContinuousSession: true,
    breakCountToday: 0,
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "long_session");
  console.log("✓ Fires long_session when user has been working continuously without breaks");
}

// ── TEST 13: Trigger 7 — task_overdue ──────────────────────────────────────
console.log("\n[TEST 13] Trigger: task_overdue");
{
  const context = createBaseContext({
    currentHour: 14,
    currentMinute: 0,
    totalMinutes: 14 * 60,
    overdueTasks: [
      {
        id: "task_algos_1",
        title: "Algorithms Problem Set",
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        isOverdue: true,
        daysOverdue: 1,
        daysSinceUpdated: 1,
        isStale: false,
      },
    ],
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "task_overdue");
  assert.strictEqual(decision.triggerContext.targetTitle, "Algorithms Problem Set");
  console.log("✓ Fires task_overdue when a task is past its due date");
}

// ── TEST 14: Trigger 8 — long_silence ──────────────────────────────────────
console.log("\n[TEST 14] Trigger: long_silence");
{
  const context = createBaseContext({
    currentHour: 14,
    currentMinute: 0,
    totalMinutes: 14 * 60,
    minutesSinceLastUserMessage: 36 * 60, // 36 hours of silence
  });
  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "long_silence");
  assert.strictEqual(decision.idempotencyKey, "user_test_123:long_silence:2026-11-13");
  console.log("✓ Fires long_silence when user hasn't talked in > 24 hours during daytime");
}

// ── TEST 15: Source Architecture & Secret Safety ───────────────────────────
console.log("\n[TEST 15] Architecture & CRON_SECRET Verification");
{
  const tickRouteSource = fs.readFileSync(path.resolve("src/app/api/nikki/tick/route.ts"), "utf8");
  assert.ok(tickRouteSource.includes("CRON_SECRET"), "Tick route must check CRON_SECRET");
  assert.ok(!tickRouteSource.includes("console.log(cronSecret)"), "Must never log CRON_SECRET");
  assert.ok(!tickRouteSource.includes("console.log(process.env.CRON_SECRET)"), "Must never print secret");

  const speakSource = fs.readFileSync(path.resolve("src/lib/nikki/speak.ts"), "utf8");
  assert.ok(speakSource.includes("NikkiNudgeModel"), "Must persist in NikkiNudgeModel");
  assert.ok(speakSource.includes("idempotencyKey"), "Must be idempotent with idempotencyKey");
  assert.ok(speakSource.includes("createNotification"), "Must reuse existing notification and push system");

  const contextSource = fs.readFileSync(path.resolve("src/lib/nikki/context.ts"), "utf8");
  assert.ok(contextSource.includes("quietHoursStart"), "Context must resolve quiet hours");
  assert.ok(contextSource.includes("unstartedStartedItems"), "Context must resolve unstarted timetable items");
  assert.ok(contextSource.includes("consecutiveIgnoredOrDismissedNudges"), "Context must track consecutive ignored nudges");

  console.log("✓ Server-side Nikki brain complies with secret safety and architectural reuse");
}

console.log("\n==========================================================");
console.log("ALL 15 NIKKI DECISION ENGINE TESTS PASSED! (15/15)");
console.log("==========================================================");

