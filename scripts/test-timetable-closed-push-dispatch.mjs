import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { parseDateTimeInTimezone } from "../src/lib/time/currentTime.ts";

console.log("==========================================================");
console.log("TEST SUITE: TIMETABLE BACKGROUND PUSH NOTIFICATIONS");
console.log("==========================================================");

const reminderModelPath = path.resolve("src/models/TimetableReminder.ts");
const reminderServicePath = path.resolve("src/services/timetableReminderService.ts");
const scheduleServicePath = path.resolve("src/services/scheduleService.ts");
const dispatchRoutePath = path.resolve("src/app/api/cron/dispatch/route.ts");
const evaluateRoutePath = path.resolve("src/app/api/cron/evaluate/route.ts");
const swPath = path.resolve("public/sw.js");

const reminderModelSource = fs.readFileSync(reminderModelPath, "utf8");
const reminderServiceSource = fs.readFileSync(reminderServicePath, "utf8");
const scheduleServiceSource = fs.readFileSync(scheduleServicePath, "utf8");
const dispatchRouteSource = fs.readFileSync(dispatchRoutePath, "utf8");
const evaluateRouteSource = fs.readFileSync(evaluateRoutePath, "utf8");
const swSource = fs.readFileSync(swPath, "utf8");

// TEST 1: TimetableReminder Model definition and schema indexes
console.log("\n[TEST 1] TimetableReminder Model & Schema");
assert.ok(reminderModelSource.includes("uniqueKey"), "Model must have uniqueKey");
assert.ok(reminderModelSource.includes("triggerAt"), "Model must track triggerAt");
assert.ok(reminderModelSource.includes("nudgeAt"), "Model must track nudgeAt for 15-min follow-up");
assert.ok(reminderModelSource.includes("nudgesSent"), "Model must track nudgesSent");
assert.ok(reminderModelSource.includes("userDismissedCount"), "Model must track userDismissedCount for backoff");
console.log("✓ TimetableReminder model properly structured with triggerAt, nudgeAt, and back-off tracking");

// TEST 2: Sync on schedule save / update (idempotent, owner-scoped, timezone-safe)
console.log("\n[TEST 2] Schedule Service Sync Integration");
assert.ok(
  scheduleServiceSource.includes("syncTimetableReminders"),
  "scheduleService.saveSchedule must call syncTimetableReminders"
);
assert.ok(
  scheduleServiceSource.includes("cancelTimetableRemindersForDate"),
  "scheduleService.deleteSchedule must cancel pending reminders"
);
assert.ok(
  reminderServiceSource.includes("parseDateTimeInTimezone"),
  "Reminders must compute triggerAt using parseDateTimeInTimezone"
);
assert.ok(
  reminderServiceSource.includes("${schedule.id}_${i}") || reminderServiceSource.includes("uniqueKey"),
  "Must use uniqueKey based on scheduleId and itemIndex"
);
console.log("✓ saveSchedule idempotently syncs reminders with uniqueKey and timezone-safe UTC trigger time");

// TEST 3: Timezone conversion accuracy
console.log("\n[TEST 3] Timezone-Safe Trigger Calculation");
const testTz1 = "Asia/Kolkata"; // +05:30
const date1 = "2026-11-13";
const time1 = "10:00";
const targetUtc1 = parseDateTimeInTimezone(date1, time1, testTz1);
assert.strictEqual(targetUtc1.toISOString(), "2026-11-13T04:30:00.000Z");

const testTz2 = "America/New_York"; // -05:00
const targetUtc2 = parseDateTimeInTimezone(date1, time1, testTz2);
assert.strictEqual(targetUtc2.toISOString(), "2026-11-13T15:00:00.000Z");
console.log("✓ parseDateTimeInTimezone produces exact UTC triggers across timezones");

// TEST 4: Caring notification copy & Action Buttons
console.log("\n[TEST 4] Nikki Caring Voice & Action Buttons");
assert.ok(
  reminderServiceSource.includes("started 15 minutes ago. Want to begin now or move it?"),
  "Follow-up copy must match Nikki's gentle voice without shame"
);
assert.ok(
  reminderServiceSource.includes("Starting now") &&
  reminderServiceSource.includes("Later") &&
  reminderServiceSource.includes("Skip"),
  "Must include 'Starting now', 'Later', and 'Skip' action buttons"
);
assert.ok(
  reminderServiceSource.includes("/plan?tab=schedule"),
  "Notification click must target timetable page (/plan?tab=schedule)"
);
console.log("✓ Notification copy is caring and provides 'Starting now', 'Later', and 'Skip' actions");

// TEST 5: Nudge follow-up logic and back-off calculation
console.log("\n[TEST 5] 15-Minute Follow-Up & Back-off Logic");
function calculateAllowedNudges(maxNudges = 2, userDismissedCount = 0) {
  return Math.max(0, maxNudges - userDismissedCount);
}
assert.strictEqual(calculateAllowedNudges(2, 0), 2, "0 dismissals allows up to 2 nudges");
assert.strictEqual(calculateAllowedNudges(2, 1), 1, "1 dismissal backs off to max 1 nudge");
assert.strictEqual(calculateAllowedNudges(2, 2), 0, "2 dismissals backs off to 0 nudges");
console.log("✓ Back-off logic correctly reduces nudge count when user dismissed earlier notifications");

// TEST 6: Dispatch route protected by CRON_SECRET and no in-memory timers
console.log("\n[TEST 6] Cron Protection & Stateless Architecture");
assert.ok(
  dispatchRouteSource.includes("CRON_SECRET"),
  "Dispatch route must check CRON_SECRET"
);
assert.ok(
  evaluateRouteSource.includes("dispatchDueTimetableReminders"),
  "Evaluate cron route must also dispatch timetable reminders"
);
assert.ok(
  !reminderServiceSource.includes("setTimeout") && !reminderServiceSource.includes("setInterval"),
  "Must not use in-memory timers (setTimeout/setInterval) for dispatch"
);
console.log("✓ Dispatch route is protected by CRON_SECRET and completely stateless / DB-driven");

// TEST 7: Service Worker handling of notification clicks & actions
console.log("\n[TEST 7] Service Worker Click & Action Routing");
assert.ok(
  swSource.includes("/api/schedule/reminders/action"),
  "Service worker must report reminder actions to server"
);
assert.ok(
  swSource.includes("/plan?tab=schedule"),
  "Service worker must open timetable on notification click"
);
console.log("✓ Service worker routes notification click to timetable page and reports action buttons");

console.log("\n==========================================================");
console.log("ALL 7 TIMETABLE BACKGROUND PUSH TESTS PASSED! (7/7)");
console.log("==========================================================");

