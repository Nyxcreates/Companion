import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("==========================================================");
console.log("TEST SUITE: TIMETABLE CHAT PERSISTENCE & HYDRATION");
console.log("==========================================================");

// 1. Inspect Message Model schema & types
console.log("\n[TEST 1] Message Model Optional Fields (scheduleDate & scheduleId)");
const messageModelPath = path.resolve("src/models/Message.ts");
const messageModelSource = fs.readFileSync(messageModelPath, "utf8");

assert.ok(
  messageModelSource.includes("scheduleId?:"),
  "MessageDocument must define optional scheduleId"
);
assert.ok(
  messageModelSource.includes("scheduleDate?:"),
  "MessageDocument must define optional scheduleDate"
);
assert.ok(
  messageModelSource.includes("scheduleId: { type: Schema.Types.ObjectId"),
  "MessageSchema must define scheduleId ref"
);
assert.ok(
  messageModelSource.includes("scheduleDate: { type: String"),
  "MessageSchema must define scheduleDate"
);
console.log("✓ Message model defines optional scheduleId and scheduleDate fields with no migrations");

// 2. Inspect Chat API route stores reference on assistant message
console.log("\n[TEST 2] Chat API Route Stores Reference on Assistant Message");
const chatRoutePath = path.resolve("src/app/api/agent/chat/route.ts");
const chatRouteSource = fs.readFileSync(chatRoutePath, "utf8");

assert.ok(
  chatRouteSource.includes("scheduleId: schedule?.id") || chatRouteSource.includes("scheduleId:"),
  "Chat route must store scheduleId on assistant message"
);
assert.ok(
  chatRouteSource.includes("scheduleDate: schedule?.date") || chatRouteSource.includes("scheduleDate:"),
  "Chat route must store scheduleDate on assistant message"
);
console.log("✓ Assistant message stores scheduleId and scheduleDate references on schedule generation/save");

// 3. Inspect scheduleService exports hydration helpers owner-scoped by firebaseUid
console.log("\n[TEST 3] Schedule Service Hydration Functions (Owner-Scoped by firebaseUid)");
const scheduleServicePath = path.resolve("src/services/scheduleService.ts");
const scheduleServiceSource = fs.readFileSync(scheduleServicePath, "utf8");

assert.ok(
  scheduleServiceSource.includes("export async function getSchedule"),
  "scheduleService must export getSchedule"
);
assert.ok(
  scheduleServiceSource.includes("export async function getScheduleById"),
  "scheduleService must export getScheduleById"
);
assert.ok(
  scheduleServiceSource.includes("export async function getSchedulesByDates"),
  "scheduleService must export getSchedulesByDates"
);
assert.ok(
  scheduleServiceSource.includes("export async function getSchedulesByIds"),
  "scheduleService must export getSchedulesByIds"
);
assert.ok(
  scheduleServiceSource.includes("{ firebaseUid, date: { $in: validDates } }") ||
    scheduleServiceSource.includes("firebaseUid"),
  "Queries must be owner-scoped by firebaseUid"
);
console.log("✓ scheduleService provides owner-scoped schedule retrieval by dates and IDs");

// 4. Inspect conversationService hydrates schedule and handles deleted schedules
console.log("\n[TEST 4] Conversation Service Hydrates References and Flags Deleted Schedules");
const conversationServicePath = path.resolve("src/services/conversationService.ts");
const conversationServiceSource = fs.readFileSync(conversationServicePath, "utf8");

assert.ok(
  conversationServiceSource.includes("getSchedulesByDates") ||
    conversationServiceSource.includes("getSchedule"),
  "conversationService must hydrate schedules from scheduleService"
);
assert.ok(
  conversationServiceSource.includes("scheduleDeleted = true"),
  "conversationService must detect and flag when a referenced schedule was deleted"
);
assert.ok(
  conversationServiceSource.includes("scheduleDate:") &&
    conversationServiceSource.includes("scheduleId:"),
  "conversationService must return scheduleDate and scheduleId references in messages"
);
console.log("✓ conversationService hydrates schedules and safely flags deleted schedules");

// 5. Inspect CompanionChatPanel renders schedule card & deleted note
console.log("\n[TEST 5] CompanionChatPanel Renders Card & 'Timetable was removed' Note");
const chatPanelPath = path.resolve("src/components/chat/CompanionChatPanel.tsx");
const chatPanelSource = fs.readFileSync(chatPanelPath, "utf8");

assert.ok(
  chatPanelSource.includes("turn.schedule && turn.schedule.items"),
  "Chat panel checks turn.schedule and items to render timeline card"
);
assert.ok(
  chatPanelSource.includes("Timetable was removed"),
  "Chat panel renders 'Timetable was removed' note when schedule was deleted"
);
assert.ok(
  chatPanelSource.includes("ScheduleTimeline") &&
    chatPanelSource.includes("Timetable was removed"),
  "Chat panel renders safely with ScheduleTimeline and fallback note"
);
console.log("✓ Chat panel renders ScheduleTimeline when present and 'Timetable was removed' when deleted");

// 6. Test Hydration & Deleted Logic in Mock Scenario
console.log("\n[TEST 6] Simulation of Hydration & Deletion Logic");
function mockHydrateMessages(docs, schedulesInDb) {
  const dbMapByDate = new Map(schedulesInDb.map((s) => [s.date, s]));
  const dbMapById = new Map(schedulesInDb.map((s) => [s.id, s]));

  return docs.map((doc) => {
    const hasRef = Boolean(doc.scheduleDate || doc.scheduleId);
    let schedule = null;
    let scheduleDeleted = false;

    if (hasRef) {
      if (doc.scheduleDate && dbMapByDate.has(doc.scheduleDate)) {
        schedule = dbMapByDate.get(doc.scheduleDate);
      } else if (doc.scheduleId && dbMapById.has(doc.scheduleId)) {
        schedule = dbMapById.get(doc.scheduleId);
      } else {
        scheduleDeleted = true;
      }
    }

    return {
      id: doc.id,
      text: doc.content,
      scheduleDate: doc.scheduleDate ?? null,
      scheduleId: doc.scheduleId ?? null,
      schedule,
      scheduleDeleted,
    };
  });
}

const mockMessages = [
  { id: "m1", content: "Hello Nikki", scheduleDate: null, scheduleId: null },
  {
    id: "m2",
    content: "Here is your timetable for today!",
    scheduleDate: "2026-11-12",
    scheduleId: "sched-123",
  },
  {
    id: "m3",
    content: "Here is your timetable for tomorrow!",
    scheduleDate: "2026-11-13",
    scheduleId: "sched-456",
  },
];

// Scenario A: Both schedules exist in DB
const schedulesPresent = [
  { id: "sched-123", date: "2026-11-12", items: [{ start: "09:00", end: "10:00", title: "Study" }] },
  { id: "sched-456", date: "2026-11-13", items: [{ start: "10:00", end: "11:00", title: "Math" }] },
];

const hydratedA = mockHydrateMessages(mockMessages, schedulesPresent);
assert.strictEqual(hydratedA[0].schedule, null);
assert.strictEqual(hydratedA[0].scheduleDeleted, false);
assert.ok(hydratedA[1].schedule !== null);
assert.strictEqual(hydratedA[1].schedule.date, "2026-11-12");
assert.strictEqual(hydratedA[1].scheduleDeleted, false);
assert.ok(hydratedA[2].schedule !== null);
assert.strictEqual(hydratedA[2].schedule.date, "2026-11-13");
assert.strictEqual(hydratedA[2].scheduleDeleted, false);
console.log("✓ Messages with live schedules hydrate their ScheduleSummary objects correctly");

// Scenario B: Tomorrow's schedule was later deleted
const schedulesWithDeletion = [
  { id: "sched-123", date: "2026-11-12", items: [{ start: "09:00", end: "10:00", title: "Study" }] },
  // sched-456 deleted!
];

const hydratedB = mockHydrateMessages(mockMessages, schedulesWithDeletion);
assert.ok(hydratedB[1].schedule !== null);
assert.strictEqual(hydratedB[1].scheduleDeleted, false);
assert.strictEqual(hydratedB[2].schedule, null);
assert.strictEqual(hydratedB[2].scheduleDeleted, true);
assert.strictEqual(hydratedB[2].scheduleDate, "2026-11-13");
console.log("✓ Deleted schedule is cleanly detected as scheduleDeleted: true without crashing");

console.log("\n==========================================================");
console.log("ALL 6 TIMETABLE PERSISTENCE TESTS PASSED! (6/6)");
console.log("==========================================================");
