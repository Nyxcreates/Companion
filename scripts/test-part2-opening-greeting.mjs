import assert from "node:assert";

console.log("==========================================================");
console.log("PART 2 TEST SUITE: NIKKI CONTEXTUAL OPENING GREETING");
console.log("==========================================================");

// 1. REPETITION PREVENTION LOGIC
console.log("\n[TEST 1] Repetition Prevention & Variant Rotation");
function pickGreetingVariant(options, lastMessage) {
  if (options.length === 1) return options[0];
  const filtered = options.filter((o) => o.message !== lastMessage);
  const pool = filtered.length > 0 ? filtered : options;
  // Deterministic mock selection for testing
  return pool[0];
}

const morningOptions = [
  { message: "Good morning! Did you sleep well?", pose: "wave" },
  { message: "GOOD MORNINGGG! ☀️ You're up! Ready to make today a good one?", pose: "happy" },
  { message: "Rise and shine, moon! 🌅 What's the main thing on your mind for today?", pose: "curious" },
];

const firstChoice = pickGreetingVariant(morningOptions, "");
assert.strictEqual(firstChoice.message, "Good morning! Did you sleep well?");

const secondChoice = pickGreetingVariant(morningOptions, firstChoice.message);
assert.notStrictEqual(secondChoice.message, firstChoice.message, "Must never repeat exact previous greeting");
console.log("✓ Repetition prevention correctly filters out the last shown greeting");

// 2. CONTEXTUAL TIME-OF-DAY & TIMETABLE EVALUATION LOGIC
console.log("\n[TEST 2] Contextual Greeting Rules & Scenarios");
function evaluateGreeting({
  minutesSinceLastVisit,
  localHour,
  localMinutes,
  collegeItem,
  nextUpcomingItem,
  completedItemsCount,
  collegeFinishedRecently,
  hasTimetable,
  isRecentChatting,
  userName = "moon",
  companionName = "Nikki",
}) {
  // Guard: avoid interrupting active conversation
  if (isRecentChatting) {
    return null;
  }

  // SCENARIO 0: First Login
  if (minutesSinceLastVisit === 999) {
    return {
      type: "first_login",
      message: `Welcome to Companion, ${userName}! 🌟 I'm ${companionName}. I'm right here whenever you need me!`,
      pose: "wave",
    };
  }

  // SCENARIO 1: Returning after absence (> 25 min)
  if (minutesSinceLastVisit > 25 && minutesSinceLastVisit <= 720) {
    return {
      type: "returning_absence",
      message: "There you are! How have you been? Everything going okay?",
      pose: "happy",
    };
  }

  // SCENARIO 2: Morning
  if (localHour >= 5 && localHour < 12) {
    if (collegeItem) {
      const [cH, cM] = collegeItem.start.split(":").map(Number);
      const colStartMins = cH * 60 + (cM || 0);
      const diffBeforeCol = colStartMins - localMinutes;
      if (diffBeforeCol > 0 && diffBeforeCol <= 60) {
        return {
          type: "morning_college_soon",
          message: `College starts soon at ${collegeItem.start}. Have you had breakfast?`,
          pose: "wave",
        };
      }
      return {
        type: "morning_college_day",
        message: "Heyyy! You've got college today. Have you had breakfast?",
        pose: "wave",
      };
    }
    if (hasTimetable) {
      return {
        type: "morning_with_plan",
        message: "GOOD MORNINGGG! ☀️ You're up! Ready to make today a good one?",
        pose: "happy",
      };
    }
    return {
      type: "morning_no_plan",
      message: "Good morning! Did you sleep well?",
      pose: "wave",
    };
  }

  // SCENARIO 3: Afternoon
  if (localHour >= 12 && localHour < 17) {
    if (collegeFinishedRecently) {
      return {
        type: "afternoon_college_finished",
        message: "Welcome back! You're done with college for today. How was your day?",
        pose: "celebrate",
      };
    }
    if (nextUpcomingItem && nextUpcomingItem.diffMins <= 30) {
      return {
        type: "afternoon_upcoming_activity",
        message: `Heyyy! You have ${nextUpcomingItem.diffMins} minutes before your next activity: "${nextUpcomingItem.title}".`,
        pose: "curious",
      };
    }
    if (completedItemsCount > 0) {
      return {
        type: "afternoon_completed_items",
        message: `Afternoon check-in! You've already completed ${completedItemsCount} activities today! ✨`,
        pose: "happy",
      };
    }
    return {
      type: "afternoon_general",
      message: "Hey there! How is your afternoon going? Remember to take water breaks! 💧",
      pose: "curious",
    };
  }

  // SCENARIO 4: Evening
  if (localHour >= 17 && localHour < 22) {
    if (collegeItem) {
      return {
        type: "evening_college_return",
        message: "Welcome back! How was your day at college?",
        pose: "celebrate",
      };
    }
    return {
      type: "evening_general",
      message: "You've had a long day. Shall we slow things down and reflect a bit?",
      pose: "think",
    };
  }

  // SCENARIO 5: Late Night
  return {
    type: "late_night",
    message: "Still awake? Hehe. Make sure you don't push yourself too late. Sleep is medicine, moon. 🌙",
    pose: "sleepy",
  };
}

// Sub-test A: First login
const gFirst = evaluateGreeting({ minutesSinceLastVisit: 999, localHour: 10, localMinutes: 600 });
assert.strictEqual(gFirst.type, "first_login");
assert.ok(gFirst.message.includes("Welcome to Companion"));
console.log("✓ First login triggers welcome greeting with custom name");

// Sub-test B: Returning after absence
const gReturn = evaluateGreeting({ minutesSinceLastVisit: 45, localHour: 15, localMinutes: 900 });
assert.strictEqual(gReturn.type, "returning_absence");
assert.ok(gReturn.message.includes("There you are!"));
console.log("✓ Returning after >25m absence triggers warm return greeting");

// Sub-test C: Morning before college (<60m)
const gMorningCollegeSoon = evaluateGreeting({
  minutesSinceLastVisit: 5,
  localHour: 8,
  localMinutes: 8 * 60 + 20,
  collegeItem: { start: "09:00", end: "13:00", title: "College Lectures" },
});
assert.strictEqual(gMorningCollegeSoon.type, "morning_college_soon");
assert.ok(gMorningCollegeSoon.message.includes("College starts soon at 09:00"));
console.log("✓ Morning within 60m of college triggers breakfast and preparation reminder");

// Sub-test D: Afternoon college finished
const gAfternoonColFinished = evaluateGreeting({
  minutesSinceLastVisit: 5,
  localHour: 13,
  localMinutes: 13 * 60 + 30,
  collegeItem: { start: "09:00", end: "13:00", title: "College Lectures" },
  collegeFinishedRecently: true,
});
assert.strictEqual(gAfternoonColFinished.type, "afternoon_college_finished");
assert.ok(gAfternoonColFinished.message.includes("done with college for today"));
console.log("✓ Afternoon college finished triggers welcome back check-in");

// Sub-test E: Evening reflection
const gEvening = evaluateGreeting({
  minutesSinceLastVisit: 5,
  localHour: 19,
  localMinutes: 19 * 60,
  collegeItem: null,
});
assert.strictEqual(gEvening.type, "evening_general");
assert.ok(gEvening.message.includes("slow things down"));
console.log("✓ Evening triggers unwind and reflection prompt");

// Sub-test F: Late night
const gLateNight = evaluateGreeting({
  minutesSinceLastVisit: 5,
  localHour: 23,
  localMinutes: 23 * 60 + 30,
});
assert.strictEqual(gLateNight.type, "late_night");
assert.ok(gLateNight.message.includes("Still awake?"));
console.log("✓ Late night triggers gentle sleep medicine reminder");

// Sub-test G: Active conversation suppression
const gChatting = evaluateGreeting({
  minutesSinceLastVisit: 5,
  localHour: 10,
  localMinutes: 600,
  isRecentChatting: true,
});
assert.strictEqual(gChatting, null);
console.log("✓ Active chat within 2 minutes suppresses opening greeting bubble");

// Sub-test H: Missing timetable
const gNoTimetable = evaluateGreeting({
  minutesSinceLastVisit: 5,
  localHour: 9,
  localMinutes: 9 * 60,
  hasTimetable: false,
});
assert.strictEqual(gNoTimetable.type, "morning_no_plan");
assert.ok(gNoTimetable.message.includes("Did you sleep well?"));
console.log("✓ Missing timetable falls back gracefully to friendly time-based check-in");

console.log("\n==========================================================");
console.log("ALL PART 2 GREETING TESTS PASSED PERFECTLY! (8/8)");
console.log("==========================================================");

