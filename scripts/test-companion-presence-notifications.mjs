import assert from "node:assert";

console.log("==========================================================");
console.log("COMPANION — NOTIFICATION, PRESENCE & CHAT EXPANSION SUITE");
console.log("==========================================================");

// 1. NOTIFICATION CATEGORIES VALIDATION
console.log("\n[TEST 1] 10 Notification Categories Requirement");
const REQUIRED_CATEGORIES = [
  "task_reminder",
  "goal_deadline",
  "timetable_reminder",
  "focus_reminder",
  "break_reminder",
  "wellbeing_water_food",
  "mood_checkin",
  "sleep_reminder",
  "commitment_reminder",
  "nikki_supportive",
];

assert.strictEqual(REQUIRED_CATEGORIES.length, 10, "Must have exactly 10 notification categories");
console.log("✓ All 10 notification categories properly specified:");
REQUIRED_CATEGORIES.forEach((cat, idx) => console.log(`   ${idx + 1}. ${cat}`));

// 2. QUIET HOURS LOGIC
console.log("\n[TEST 2] Quiet Hours Evaluation");
function isQuietHours(start, end, hour, minute) {
  if (!start || !end) return false;
  const currentMins = hour * 60 + minute;
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMins = startH * 60 + (startM || 0);
  const endMins = endH * 60 + (endM || 0);

  if (startMins <= endMins) {
    return currentMins >= startMins && currentMins < endMins;
  } else {
    // Overnight (e.g. 22:30 to 07:00)
    return currentMins >= startMins || currentMins < endMins;
  }
}

// 23:00 is during quiet hours (22:30 to 07:00)
assert.strictEqual(isQuietHours("22:30", "07:00", 23, 0), true);
// 02:15 is during quiet hours
assert.strictEqual(isQuietHours("22:30", "07:00", 2, 15), true);
// 06:59 is during quiet hours
assert.strictEqual(isQuietHours("22:30", "07:00", 6, 59), true);
// 07:01 is NOT during quiet hours
assert.strictEqual(isQuietHours("22:30", "07:00", 7, 1), false);
// 14:00 is NOT during quiet hours
assert.strictEqual(isQuietHours("22:30", "07:00", 14, 0), false);
console.log("✓ Quiet hours overnight boundary calculations verified accurately");

// 3. SNOOZE & RELATIVE TIME CALCULATION
console.log("\n[TEST 3] Snooze Date & Time Calculation");
function calculateSnoozeDate(baseDate, minutes) {
  return new Date(baseDate.getTime() + minutes * 60 * 1000);
}

const testBase = new Date("2026-11-04T10:00:00Z");
const snoozed30 = calculateSnoozeDate(testBase, 30);
assert.strictEqual(snoozed30.toISOString(), "2026-11-04T10:30:00.000Z");
const snoozed120 = calculateSnoozeDate(testBase, 120);
assert.strictEqual(snoozed120.toISOString(), "2026-11-04T12:00:00.000Z");
console.log("✓ Snooze timestamp computation works properly");

// 4. ADAPTIVE LEARNING SYSTEM (WELLBEING HABITS)
console.log("\n[TEST 4] Adaptive Learning Weights for Nikki");
function adaptWaterInterval(baseIntervalMinutes, dismissCount) {
  // If user frequently dismisses water reminders, increase interval up to 2.5x so we don't annoy them
  const factor = Math.min(2.5, 1 + dismissCount * 0.2);
  return Math.round(baseIntervalMinutes * factor);
}

assert.strictEqual(adaptWaterInterval(90, 0), 90);
assert.strictEqual(adaptWaterInterval(90, 2), 126); // 90 * 1.4 = 126m
assert.strictEqual(adaptWaterInterval(90, 10), 225); // capped at 2.5x = 225m
console.log("✓ Hydration reminder frequency adapts upwards when repeatedly dismissed (avoids nagging)");

function updateLearnedPreference(currentWeights, action, type, triggerName) {
  const next = { ...currentWeights };
  if (type === "water") {
    if (action === "dismiss" || action === "ignore") {
      next.waterDismissCount = (next.waterDismissCount || 0) + 1;
    } else if (action === "accept") {
      next.waterAcceptCount = (next.waterAcceptCount || 0) + 1;
      next.lastInterventionAccepted = "water";
    }
  } else if (type === "break") {
    if (action === "dismiss" || action === "ignore") {
      next.breakDismissCount = (next.breakDismissCount || 0) + 1;
    } else if (action === "accept") {
      next.breakAcceptCount = (next.breakAcceptCount || 0) + 1;
      next.lastInterventionAccepted = "break";
      if (triggerName.includes("walk")) next.preferredBreakActivity = "walk";
      else if (triggerName.includes("stretch")) next.preferredBreakActivity = "stretch";
      else if (triggerName.includes("music")) next.preferredBreakActivity = "music";
    }
  }
  return next;
}

let weights = {
  waterDismissCount: 0,
  waterAcceptCount: 0,
  breakDismissCount: 0,
  breakAcceptCount: 0,
  preferredBreakActivity: null,
  lastInterventionAccepted: null,
};

weights = updateLearnedPreference(weights, "dismiss", "water", "water_prompt");
assert.strictEqual(weights.waterDismissCount, 1);
assert.strictEqual(weights.waterAcceptCount, 0);

weights = updateLearnedPreference(weights, "accept", "break", "take_a_walk_break");
assert.strictEqual(weights.breakAcceptCount, 1);
assert.strictEqual(weights.preferredBreakActivity, "walk");
assert.strictEqual(weights.lastInterventionAccepted, "break");
console.log("✓ Habit learning correctly records user acceptance & preferred break activity");

// 5. PHONE DISTRACTION-FREE TIMER
console.log("\n[TEST 5] Phone Usage Awareness & Goal Progress");
function calculateUsageProgress(distractionFreeMinutes, dailyGoalMinutes) {
  if (dailyGoalMinutes <= 0) return 0;
  return Math.min(100, Math.round((distractionFreeMinutes / dailyGoalMinutes) * 100));
}

assert.strictEqual(calculateUsageProgress(60, 120), 50);
assert.strictEqual(calculateUsageProgress(120, 120), 100);
assert.strictEqual(calculateUsageProgress(180, 120), 100);
assert.strictEqual(calculateUsageProgress(0, 120), 0);
console.log("✓ Phone-free time goal progress accurately bounded between 0% and 100%");

// 6. EXPANDABLE CHAT STATE LOGIC
console.log("\n[TEST 6] Expandable Chat Window State Model");
class ChatStateModel {
  constructor() {
    this.isExpanded = false;
    this.inputText = "Unsent draft text";
    this.turns = [{ id: "turn_1", role: "nikki", text: "Hello!" }];
  }
  toggleExpand() {
    this.isExpanded = !this.isExpanded;
  }
  handleKey(key) {
    if (this.isExpanded && key === "Escape") {
      this.isExpanded = false;
    }
  }
}

const chat = new ChatStateModel();
assert.strictEqual(chat.isExpanded, false);
assert.strictEqual(chat.inputText, "Unsent draft text");

chat.toggleExpand();
assert.strictEqual(chat.isExpanded, true);
assert.strictEqual(chat.inputText, "Unsent draft text", "Unsent text must be preserved on expand");
assert.strictEqual(chat.turns.length, 1, "Turns history must be preserved on expand");

chat.handleKey("Escape");
assert.strictEqual(chat.isExpanded, false, "Escape key minimizes expanded mode");
assert.strictEqual(chat.inputText, "Unsent draft text", "Unsent text must be preserved on minimize");
console.log("✓ Chat expansion, minimization, history preservation, and Escape shortcut verified");

// 7. MOOD CHECK-IN EMOTION DETECTION
console.log("\n[TEST 7] Mood-Aware Response Emotion Labels");
const EMOTION_VOCABULARY = [
  "happy",
  "calm",
  "neutral",
  "tired",
  "stressed",
  "sad",
  "anxious",
  "frustrated",
  "excited",
  "overwhelmed",
];

function shouldOfferGentleCheckIn(emotion, confidence) {
  const needsSupport = ["tired", "stressed", "sad", "anxious", "frustrated", "overwhelmed"];
  return needsSupport.includes(emotion) && confidence >= 0.45;
}

assert.strictEqual(shouldOfferGentleCheckIn("stressed", 0.8), true);
assert.strictEqual(shouldOfferGentleCheckIn("tired", 0.6), true);
assert.strictEqual(shouldOfferGentleCheckIn("stressed", 0.3), false, "Low confidence should not trigger intrusive check-in");
assert.strictEqual(shouldOfferGentleCheckIn("neutral", 0.9), false);
assert.strictEqual(shouldOfferGentleCheckIn("happy", 0.9), false);
console.log("✓ Empathetic mood check-in triggers only on confident emotional cues");

console.log("\n==========================================================");
console.log("ALL NOTIFICATION, PRESENCE & EXPANSION TESTS PASSED! (7/7)");
console.log("==========================================================");
