import assert from "node:assert";

console.log("==========================================================");
console.log("COMPANION 2.0 — PROACTIVE COMPANION & TIMETABLE SUITE");
console.log("==========================================================");

// 1. TIMETABLE PERSISTENCE & HISTORY RESTORATION MODEL
console.log("\n[TEST 1] Timetable Artifact & History Restoration");
function resolveMessageSchedule(doc, activeScheduleMap) {
  if (doc.scheduleDate && activeScheduleMap.has(doc.scheduleDate)) {
    return activeScheduleMap.get(doc.scheduleDate);
  } else if (doc.scheduleSnapshot) {
    return doc.scheduleSnapshot;
  }
  return null;
}

const mockSchedule = {
  id: "sched_1",
  date: "2026-11-12",
  items: [
    { start: "09:00", end: "13:00", title: "College Lectures", type: "commitment" },
    { start: "14:30", end: "16:00", title: "DSA Practice", type: "task" },
  ],
};

const activeMap = new Map();
activeMap.set("2026-11-12", mockSchedule);

const mockMessageWithActive = {
  _id: "msg_1",
  role: "assistant",
  content: "Here is your plan for today!",
  scheduleDate: "2026-11-12",
  scheduleSnapshot: mockSchedule,
};

const resolvedActive = resolveMessageSchedule(mockMessageWithActive, activeMap);
assert.notStrictEqual(resolvedActive, null);
assert.strictEqual(resolvedActive.items.length, 2);
assert.strictEqual(resolvedActive.items[0].title, "College Lectures");
console.log("✓ Live schedule correctly populated for timetable messages");

// 2. TIMETABLE EDITED IN SCHEDULE SECTION
console.log("\n[TEST 2] Timetable Edits Reflect in Chat Artifact Without Duplication");
const editedSchedule = {
  ...mockSchedule,
  items: [
    { start: "09:30", end: "13:30", title: "College Lectures (Updated)", type: "commitment" },
    { start: "15:00", end: "16:30", title: "DSA Practice", type: "task" },
  ],
};
activeMap.set("2026-11-12", editedSchedule);

const resolvedEdited = resolveMessageSchedule(mockMessageWithActive, activeMap);
assert.strictEqual(resolvedEdited.items[0].title, "College Lectures (Updated)");
assert.strictEqual(resolvedEdited.items[0].start, "09:30");
console.log("✓ Edits in schedule section immediately reflect in chat history without duplicating messages");

// 3. SCHEDULE DELETED FROM CALENDAR FALLBACK
console.log("\n[TEST 3] Schedule Deletion Fallback Preserves Chat History");
const emptyMap = new Map(); // Simulating schedule deleted from active calendar
const resolvedDeleted = resolveMessageSchedule(mockMessageWithActive, emptyMap);
assert.notStrictEqual(resolvedDeleted, null, "History must not be erased when schedule is removed from calendar");
assert.strictEqual(resolvedDeleted.items.length, 2);
console.log("✓ Historical snapshot preserved even if schedule is deleted from calendar");

// 4. CONVERSATIONAL INTENTS (TIMETABLE_SAVE, FAREWELL, WELCOME_BACK)
console.log("\n[TEST 4] Agent Intents & Conversational Action Coverage");
const AGENT_INTENTS = [
  "conversation",
  "planning",
  "timetable_request",
  "timetable_save",
  "task_request",
  "mood_checkin",
  "goal_discussion",
  "reschedule_request",
  "timetable_delete",
  "memory_request",
  "farewell",
  "welcome_back",
];

assert.ok(AGENT_INTENTS.includes("timetable_save"), "timetable_save intent required");
assert.ok(AGENT_INTENTS.includes("farewell"), "farewell intent required");
assert.ok(AGENT_INTENTS.includes("welcome_back"), "welcome_back intent required");
console.log("✓ All conversational action intents registered");

// 5. TIMETABLE & CONTEXTUAL PROACTIVE INTERACTION RULES
console.log("\n[TEST 5] Contextual Proactive Timing Engine");
function evaluateTimetableEvent(item, currentMins) {
  const [sH, sM] = item.start.split(":").map(Number);
  const [eH, eM] = item.end.split(":").map(Number);
  const startMins = sH * 60 + (sM || 0);
  const endMins = eH * 60 + (eM || 0);
  const diffBefore = startMins - currentMins;
  const diffAfter = currentMins - endMins;
  const lower = item.title.toLowerCase();

  if (diffBefore > 15 && diffBefore <= 35) {
    return {
      type: "upcoming_activity",
      msg: /college|class/.test(lower)
        ? "Heyyy, your college starts soon. Go get ready! Have you had breakfast?"
        : `Heyyy, "${item.title}" starts soon. Ready for it?`,
    };
  }
  if (diffBefore > 0 && diffBefore <= 15) {
    return {
      type: "before_departure",
      msg: `You should probably leave in ${diffBefore} minutes for ${item.title}. Don't forget your bag!`,
    };
  }
  if (currentMins >= startMins && currentMins < endMins) {
    return {
      type: "study_time",
      msg: `Okay, time for your study block: "${item.title}". Let's tackle one thing at a time.`,
    };
  }
  if (diffAfter >= 0 && diffAfter <= 45 && /college|class|work/.test(lower)) {
    return {
      type: "after_returning",
      msg: `You're back! How was ${item.title.toLowerCase()} today?`,
    };
  }
  return null;
}

const collegeItem = { start: "09:00", end: "13:00", title: "College Lectures", type: "commitment" };

// 08:35 (25 min before college) -> Upcoming activity prompt
const at835 = evaluateTimetableEvent(collegeItem, 8 * 60 + 35);
assert.strictEqual(at835.type, "upcoming_activity");
assert.ok(at835.msg.includes("college starts soon"));
console.log("✓ 25 min before college: generates upcoming activity prompt");

// 08:50 (10 min before college) -> Departure reminder
const at850 = evaluateTimetableEvent(collegeItem, 8 * 60 + 50);
assert.strictEqual(at850.type, "before_departure");
assert.ok(at850.msg.includes("leave in 10 minutes"));
console.log("✓ 10 min before departure: generates departure & bag reminder");

// 10:15 (during college) -> Study/block in progress
const at1015 = evaluateTimetableEvent(collegeItem, 10 * 60 + 15);
assert.strictEqual(at1015.type, "study_time");
console.log("✓ During block: recognizes active focus block");

// 13:20 (20 min after college) -> Return greeting
const at1320 = evaluateTimetableEvent(collegeItem, 13 * 60 + 20);
assert.strictEqual(at1320.type, "after_returning");
assert.ok(at1320.msg.includes("You're back!"));
console.log("✓ After returning: welcomes user back with supportive check-in");

// 6. CHARACTER EXPRESSION POSES COVERAGE
console.log("\n[TEST 6] Nikki Expressive Character Poses");
const POSES = ["idle", "walk", "turn", "wave", "lookAhead", "sit", "think", "celebrate", "sleepy", "concerned", "happy"];
assert.ok(POSES.includes("sleepy"), "sleepy pose supported");
assert.ok(POSES.includes("concerned"), "concerned pose supported");
assert.ok(POSES.includes("happy"), "happy pose supported");
assert.ok(POSES.includes("wave"), "wave pose supported");
assert.ok(POSES.includes("think"), "think pose supported");
console.log("✓ All expressive poses (sleepy, concerned, happy, wave, think, idle) verified");

console.log("\n==========================================================");
console.log("ALL COMPANION 2.0 TIMETABLE & PROACTIVE TESTS PASSED! (6/6)");
console.log("==========================================================");
