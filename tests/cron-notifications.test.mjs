import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateVAPIDKeys } from "web-push";
import { verifyCronAuth, verifyCronBearerToken } from "../src/lib/api/verifyCronAuth.ts";
import {
  claimNotificationIdempotency,
  NotificationIdempotencyModel,
} from "../src/models/NotificationIdempotency.ts";
import {
  validateVapidKeyPair,
  getVapidDiagnostics,
} from "../src/lib/vapidKeyValidation.ts";
import { decideNikkiNudge } from "../src/lib/nikki/decide.ts";

test("vercel.json does not contain incompatible Hobby cron schedules", () => {
  const raw = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.equal("crons" in parsed, false, "vercel.json must not define crons");
});

test("verifyCronBearerToken rejects missing, empty, or malformed secrets", () => {
  assert.equal(verifyCronBearerToken(null, "super-secret"), false);
  assert.equal(verifyCronBearerToken(undefined, "super-secret"), false);
  assert.equal(verifyCronBearerToken("", "super-secret"), false);
  assert.equal(verifyCronBearerToken("Basic super-secret", "super-secret"), false);
  assert.equal(verifyCronBearerToken("Bearer wrong-secret", "super-secret"), false);
  assert.equal(verifyCronBearerToken("Bearer super-secret", ""), false);
  assert.equal(verifyCronBearerToken("Bearer super-secret", undefined), false);
});

test("verifyCronBearerToken accepts exact Bearer CRON_SECRET match", () => {
  assert.equal(verifyCronBearerToken("Bearer super-secret-123", "super-secret-123"), true);
  assert.equal(verifyCronBearerToken("bearer super-secret-123", "super-secret-123"), true);
});

test("validateVapidKeyPair correctly validates matching and mismatching keypairs", () => {
  const pairA = generateVAPIDKeys();
  const pairB = generateVAPIDKeys();

  // Valid pair from same generation
  const matchResult = validateVapidKeyPair(pairA.publicKey, pairA.privateKey);
  assert.equal(matchResult.valid, true);

  // Mismatched keys from different generations
  const mismatchResult = validateVapidKeyPair(pairA.publicKey, pairB.privateKey);
  assert.equal(mismatchResult.valid, false);
  assert.match(mismatchResult.error, /do not belong to the same keypair/i);

  // Malformed lengths
  const malformed = validateVapidKeyPair("not-a-valid-key", pairA.privateKey);
  assert.equal(malformed.valid, false);
});

test("getVapidDiagnostics reports presence and match status without leaking private key", () => {
  const origPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const origPriv = process.env.VAPID_PRIVATE_KEY;
  const origSub = process.env.VAPID_SUBJECT;

  try {
    const pair = generateVAPIDKeys();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = pair.publicKey;
    process.env.VAPID_PRIVATE_KEY = pair.privateKey;
    process.env.VAPID_SUBJECT = "mailto:test@example.com";

    const diag = getVapidDiagnostics();
    assert.equal(diag.hasPublicKey, true);
    assert.equal(diag.hasPrivateKey, true);
    assert.equal(diag.hasSubject, true);
    assert.equal(diag.keysMatch, true);
    // Ensure no private key string leaked in diagnostics object
    assert.equal("privateKey" in diag, false);
  } finally {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = origPub;
    process.env.VAPID_PRIVATE_KEY = origPriv;
    process.env.VAPID_SUBJECT = origSub;
  }
});

test("claimNotificationIdempotency allows first claim and blocks concurrent/duplicate claims", async () => {
  const seenKeys = new Set();
  const originalCreate = NotificationIdempotencyModel.create;

  NotificationIdempotencyModel.create = async (doc) => {
    if (seenKeys.has(doc.key)) {
      const err = new Error("E11000 duplicate key error");
      err.code = 11000;
      throw err;
    }
    seenKeys.add(doc.key);
    return doc;
  };

  try {
    const [first, second, third] = await Promise.all([
      claimNotificationIdempotency("uid1:morning_overview:2026-11-27", "uid1", "proactive", 60_000),
      claimNotificationIdempotency("uid1:morning_overview:2026-11-27", "uid1", "proactive", 60_000),
      claimNotificationIdempotency("uid1:morning_overview:2026-11-27", "uid1", "proactive", 60_000),
    ]);

    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(third, false);

    const otherKey = await claimNotificationIdempotency(
      "uid1:evening_reflection:2026-11-27",
      "uid1",
      "proactive",
      60_000
    );
    assert.equal(otherKey, true);

    // Concurrent hydration bucket claims only succeed once
    const [water1, water2] = await Promise.all([
      claimNotificationIdempotency("uid1:water:12345", "uid1", "proactive", 60_000),
      claimNotificationIdempotency("uid1:water:12345", "uid1", "proactive", 60_000),
    ]);
    assert.equal(water1, true);
    assert.equal(water2, false);
  } finally {
    NotificationIdempotencyModel.create = originalCreate;
  }
});

test("verifyCronAuth rejects missing or invalid Authorization headers and accepts valid Bearer CRON_SECRET", () => {
  const origSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret-value";
  try {
    assert.equal(verifyCronAuth({ headers: new Headers() }), false);
    assert.equal(
      verifyCronAuth({ headers: new Headers({ authorization: "Bearer wrong-secret" }) }),
      false
    );
    assert.equal(
      verifyCronAuth({ headers: new Headers({ authorization: "Bearer test-cron-secret-value" }) }),
      true
    );
  } finally {
    if (origSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = origSecret;
  }
});

function makeBaseContext(overrides = {}) {
  return {
    firebaseUid: "user-1",
    userName: "Nishtha",
    companionName: "Nikki",
    timezone: "Asia/Kolkata",
    localDate: "2026-11-27",
    localTime: "08:05",
    currentHour: 8,
    totalMinutes: 8 * 60 + 5,
    usualWakeTime: "07:30",
    usualBedtime: "23:00",
    proactiveEnabled: true,
    isPaused: false,
    isQuietHours: false,
    quietHoursStart: "22:30",
    quietHoursEnd: "07:00",
    morningCheckInEnabled: true,
    morningCheckInTime: "08:00",
    eveningCheckInEnabled: true,
    eveningCheckInTime: "20:00",
    checkInFrequency: "balanced",
    strictness: "playful",
    consecutiveIgnoredOrDismissedNudges: 0,
    nudgesSentTodayCount: 0,
    lastNudge: null,
    isFocusSessionJustFinished: false,
    lastFocusSession: null,
    approachingDeadlineTasks: [],
    missedActivities: [],
    unstartedStartedItems: [],
    minutesSinceLastUserMessage: 60,
    minutesSinceLastSeen: 120,
    totalPendingTasksCount: 1,
    scheduleItems: [{ title: "Deep Work", start: "09:00", end: "10:00" }],
    incompleteTasks: [],
    hydrationCountToday: 1,
    isFirstOpenOfDay: false,
    hasScheduleToday: true,
    completedActivitiesCountToday: 0,
    completedTasksCountToday: 0,
    isReturningAfterAbsence: false,
    importantUnfinishedTasks: [],
    goalsMakingGoodProgress: [],
    neglectedGoals: [],
    overdueTasks: [],
    staleTasks: [],
    repeatedlyPostponedTasks: [],
    isLongContinuousSession: false,
    breakCountToday: 0,
    recentMoods: [],
    ...overrides,
  };
}

test("decideNikkiNudge triggers morning_plan at 08:00, evening_checkin at 20:00, and respects quiet hours", () => {
  const morning = decideNikkiNudge(makeBaseContext({ currentHour: 8, totalMinutes: 8 * 60 + 5 }));
  assert.equal(morning.shouldSpeak, true);
  assert.equal(morning.trigger, "morning_plan");

  const evening = decideNikkiNudge(
    makeBaseContext({
      localTime: "20:05",
      currentHour: 20,
      totalMinutes: 20 * 60 + 5,
    })
  );
  assert.equal(evening.shouldSpeak, true);
  assert.equal(evening.trigger, "evening_checkin");

  const quiet = decideNikkiNudge(makeBaseContext({ isQuietHours: true }));
  assert.equal(quiet.shouldSpeak, false);
});
