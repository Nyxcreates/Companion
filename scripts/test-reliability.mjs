import assert from "node:assert";

// 1. TIMEZONE & CURRENT TIME TESTS
console.log("--- TEST GROUP 1: Timezone & Runtime Clock ---");

function isValidTimezone(tz) {
  if (typeof tz !== "string" || tz.trim().length === 0) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

function resolveUserTimezone(clientTimezone, profileTimezone) {
  if (clientTimezone && isValidTimezone(clientTimezone)) {
    return clientTimezone.trim();
  }
  if (profileTimezone && isValidTimezone(profileTimezone)) {
    return profileTimezone.trim();
  }
  try {
    const hostTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimezone(hostTz)) return hostTz;
  } catch {}
  return "UTC";
}

function formatDateInTimezone(date, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatTimeInTimezone(date, timezone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function resolveTargetDate(userMessage, timezone) {
  const lower = userMessage.toLowerCase();
  const explicitMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicitMatch) return explicitMatch[1];

  const now = new Date();
  const todayStr = formatDateInTimezone(now, timezone);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateInTimezone(tomorrow, timezone);

  if (lower.includes("tomorrow")) return tomorrowStr;
  return todayStr;
}

// Tests
assert.strictEqual(isValidTimezone("Asia/Kolkata"), true);
assert.strictEqual(isValidTimezone("America/New_York"), true);
assert.strictEqual(isValidTimezone("Europe/London"), true);
assert.strictEqual(isValidTimezone("Invalid/Tz_Name"), false);
assert.strictEqual(isValidTimezone(""), false);

assert.strictEqual(resolveUserTimezone("Asia/Kolkata", "UTC"), "Asia/Kolkata");
assert.strictEqual(resolveUserTimezone(null, "Europe/Paris"), "Europe/Paris");
assert.strictEqual(resolveUserTimezone("Invalid", "America/Chicago"), "America/Chicago");
assert.strictEqual(resolveUserTimezone("Invalid", "Invalid"), resolveUserTimezone());

const fixedNow = new Date("2026-10-24T11:30:00Z"); // 17:00 IST (UTC+5:30)
assert.strictEqual(formatDateInTimezone(fixedNow, "Asia/Kolkata"), "2026-10-24");
assert.strictEqual(formatTimeInTimezone(fixedNow, "Asia/Kolkata"), "17:00");

// Target Date resolution tests
const tz = "Asia/Kolkata";
const todayStr = formatDateInTimezone(new Date(), tz);
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrowStr = formatDateInTimezone(tomorrowDate, tz);

assert.strictEqual(resolveTargetDate("plan my day", tz), todayStr);
assert.strictEqual(resolveTargetDate("make a timetable for me", tz), todayStr);
assert.strictEqual(resolveTargetDate("what should I do tonight?", tz), todayStr);
assert.strictEqual(resolveTargetDate("plan tomorrow for me", tz), tomorrowStr);
assert.strictEqual(resolveTargetDate("schedule for 2026-11-15", tz), "2026-11-15");
console.log("PASS: Timezone & Runtime Clock tests");

// 2. TIMETABLE DETERMINISTIC VALIDATION & PAST-ACTIVITY FILTERING
console.log("\n--- TEST GROUP 2: Timetable Validation & Past-Activity Elimination ---");

function timeStringToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes) {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VALID_TYPES = ["task", "break", "commitment", "free"];
const MIN_BLOCK_MINUTES = 5;

function validateAndRepairSchedule(raw, ownedTaskIds, options = {}) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("No schedule blocks");
  }

  const currentMinutes = options.currentTime && TIME_RE.test(options.currentTime)
    ? timeStringToMinutes(options.currentTime)
    : null;

  const parsedItems = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const start = typeof entry.start === "string" ? entry.start.trim() : "";
    const end = typeof entry.end === "string" ? entry.end.trim() : "";
    const title = typeof entry.title === "string" ? entry.title.trim() : "";
    const rawType = VALID_TYPES.includes(entry.type) ? entry.type : "free";

    if (!TIME_RE.test(start) || !TIME_RE.test(end)) continue;
    if (!title || timeStringToMinutes(end) <= timeStringToMinutes(start)) continue;

    const taskId = entry.taskId && ownedTaskIds.has(entry.taskId) ? entry.taskId : null;

    parsedItems.push({
      start,
      end,
      title,
      type: rawType === "commitment" ? "commitment" : taskId ? "task" : rawType,
      taskId,
    });
  }

  const timeFiltered = [];
  for (const item of parsedItems) {
    let startMin = timeStringToMinutes(item.start);
    const endMin = timeStringToMinutes(item.end);

    if (options.isToday && currentMinutes !== null) {
      if (endMin <= currentMinutes) continue; // Past
      if (startMin < currentMinutes) startMin = currentMinutes; // Clip forward
      if (endMin - startMin < MIN_BLOCK_MINUTES) continue;
    }

    timeFiltered.push({
      ...item,
      start: minutesToTimeString(startMin),
      end: minutesToTimeString(endMin),
    });
  }

  if (timeFiltered.length === 0) {
    throw new Error("All items in past or invalid");
  }

  const commitments = [];
  const flexibleItems = [];

  for (const item of timeFiltered) {
    if (item.type === "commitment") commitments.push(item);
    else flexibleItems.push(item);
  }

  commitments.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));
  const cleanCommitments = [];
  let commitmentCursor = options.isToday && currentMinutes !== null ? currentMinutes : 0;

  for (const c of commitments) {
    let cStart = timeStringToMinutes(c.start);
    const cEnd = timeStringToMinutes(c.end);
    if (cStart < commitmentCursor) cStart = commitmentCursor;
    if (cEnd - cStart >= MIN_BLOCK_MINUTES) {
      cleanCommitments.push({ ...c, start: minutesToTimeString(cStart), end: minutesToTimeString(cEnd) });
      commitmentCursor = cEnd;
    }
  }

  flexibleItems.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));
  const allScheduled = [...cleanCommitments];

  for (const flex of flexibleItems) {
    let flexStart = timeStringToMinutes(flex.start);
    let flexEnd = timeStringToMinutes(flex.end);
    const flexDuration = flexEnd - flexStart;

    for (const com of cleanCommitments) {
      const comStart = timeStringToMinutes(com.start);
      const comEnd = timeStringToMinutes(com.end);

      if (flexStart < comEnd && flexEnd > comStart) {
        if (flexStart < comStart && comStart - flexStart >= 15) {
          flexEnd = comStart;
        } else {
          flexStart = comEnd;
          flexEnd = Math.min(23 * 60 + 59, flexStart + flexDuration);
        }
      }
    }

    if (flexEnd - flexStart >= MIN_BLOCK_MINUTES && flexEnd <= 24 * 60) {
      allScheduled.push({
        ...flex,
        start: minutesToTimeString(flexStart),
        end: minutesToTimeString(flexEnd),
      });
    }
  }

  allScheduled.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));
  const finalRepaired = [];
  let cursor = options.isToday && currentMinutes !== null ? currentMinutes : 0;

  for (const item of allScheduled) {
    let startMin = timeStringToMinutes(item.start);
    const endMin = timeStringToMinutes(item.end);

    if (item.type === "commitment") {
      if (startMin >= cursor && endMin > startMin) {
        finalRepaired.push(item);
        cursor = endMin;
      }
    } else {
      if (startMin < cursor) startMin = cursor;
      if (endMin - startMin >= MIN_BLOCK_MINUTES && endMin <= 24 * 60) {
        finalRepaired.push({
          ...item,
          start: minutesToTimeString(startMin),
          end: minutesToTimeString(endMin),
        });
        cursor = endMin;
      }
    }
  }

  return finalRepaired;
}

// Real-world scenario from Bug 1:
// Current time: 17:00 (5 PM).
// Nikki proposed morning activities (07:30, 09:00, 14:00) and evening activities.
const proposedAt5PM = [
  { start: "07:30", end: "08:30", title: "Morning stretch & breakfast", type: "break" },
  { start: "09:00", end: "12:00", title: "College classes", type: "task" },
  { start: "14:00", end: "15:30", title: "Study biology", type: "task" },
  { start: "16:30", end: "17:30", title: "Quick review", type: "task" },
  { start: "17:00", end: "21:00", title: "Visit Mami's house", type: "commitment" },
  { start: "21:30", end: "22:30", title: "Work on dad's website", type: "task" },
];

const repairedToday = validateAndRepairSchedule(proposedAt5PM, new Set(), {
  isToday: true,
  currentTime: "17:00",
});

// Check that 07:30, 09:00, 14:00 were eliminated
assert.strictEqual(repairedToday.some((i) => i.title.includes("Morning")), false);
assert.strictEqual(repairedToday.some((i) => i.title.includes("classes")), false);
assert.strictEqual(repairedToday.some((i) => i.title.includes("biology")), false);

// Check that no activity starts before 17:00
for (const item of repairedToday) {
  assert.ok(
    timeStringToMinutes(item.start) >= timeStringToMinutes("17:00"),
    `Activity ${item.title} starts at ${item.start}, which is before 17:00!`
  );
}

// Check that fixed commitment "Visit Mami's house" is preserved at 17:00-21:00
const mamiCommitment = repairedToday.find((i) => i.title.includes("Mami"));
assert.ok(mamiCommitment, "Commitment must be present");
assert.strictEqual(mamiCommitment.start, "17:00");
assert.strictEqual(mamiCommitment.end, "21:00");
assert.strictEqual(mamiCommitment.type, "commitment");

// Check that "Work on dad's website" is scheduled after Mami's house without overlap
const dadWebsite = repairedToday.find((i) => i.title.includes("dad's website"));
assert.ok(dadWebsite, "Dad's website task must be present");
assert.ok(timeStringToMinutes(dadWebsite.start) >= timeStringToMinutes("21:00"));

// Verify no items overlap
for (let i = 0; i < repairedToday.length - 1; i++) {
  const cur = repairedToday[i];
  const next = repairedToday[i + 1];
  assert.ok(
    timeStringToMinutes(cur.end) <= timeStringToMinutes(next.start),
    `Overlap detected between ${cur.title} (${cur.start}-${cur.end}) and ${next.title} (${next.start}-${next.end})`
  );
}

// Verify that for a future day (not today), morning activities are kept:
const repairedTomorrow = validateAndRepairSchedule(proposedAt5PM, new Set(), {
  isToday: false,
});
assert.ok(repairedTomorrow.some((i) => i.title.includes("Morning")));
assert.ok(repairedTomorrow.some((i) => i.title.includes("classes")));
console.log("PASS: Timetable Validation & Past-Activity Elimination tests");

// 3. CONSTRAINT & MEMORY EXTRACTION SAFETY NET
console.log("\n--- TEST GROUP 3: Explicit Memory Request Safety Net & Deduplication ---");

const testExplicitPhrases = [
  "Remember that I study best after 9 PM.",
  "Please remember that I'm allergic to peanuts",
  "Don't forget that I have a doctor appointment on Thursdays",
  "Keep in mind that I prefer short focus sessions",
  "Note that my preferred programming language is TypeScript",
];

const rememberRegex = /(?:please\s+)?(?:remember|don't\s+forget|keep\s+in\s+mind|note\s+that)\s+(?:that\s+)?(.+)/i;

for (const phrase of testExplicitPhrases) {
  const match = phrase.match(rememberRegex);
  assert.ok(match, `Failed to match explicit remember phrase: "${phrase}"`);
  const fact = match[1].trim().replace(/[.!?]+$/, "");
  assert.ok(fact.length > 5, `Extracted fact too short: "${fact}"`);
}

// Test deduplication regex
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const fact1 = "I study best after 9 PM";
const reg = new RegExp(`^${escapeRegex(fact1)}$`, "i");
assert.ok(reg.test("I study best after 9 PM"));
assert.ok(reg.test("i study best after 9 pm"));
assert.ok(!reg.test("I study best in the morning"));

console.log("PASS: Memory safety net and deduplication tests");

console.log("\nALL 3 TEST SUITES PASSED COMPLETELY!");

// 4. CHAT KEYBOARD & IME BEHAVIOR TESTS
console.log("\n--- TEST GROUP 4: Chat Keyboard & IME Behavior ---");

function simulateKeyDown(e, state) {
  // If not Enter, never submit
  if (e.key !== "Enter") return { shouldSubmit: false, reason: "not-enter" };
  // Shift+Enter -> newline, never submit
  if (e.shiftKey) return { shouldSubmit: false, reason: "shift-enter-newline" };
  // Touch keyboard configured for newline
  if (state.enterInsertsNewline) return { shouldSubmit: false, reason: "mobile-newline" };
  // IME active (composing)
  if (state.isComposing || e.isComposing || e.keyCode === 229) {
    return { shouldSubmit: false, reason: "ime-composing" };
  }
  // Enter without shift
  return { shouldSubmit: true, reason: "enter-submit" };
}

// Plain Enter on desktop -> submits
assert.deepStrictEqual(
  simulateKeyDown({ key: "Enter", shiftKey: false, isComposing: false }, { enterInsertsNewline: false, isComposing: false }),
  { shouldSubmit: true, reason: "enter-submit" }
);

// Shift + Enter on desktop -> newline, never submit
assert.deepStrictEqual(
  simulateKeyDown({ key: "Enter", shiftKey: true, isComposing: false }, { enterInsertsNewline: false, isComposing: false }),
  { shouldSubmit: false, reason: "shift-enter-newline" }
);

// Enter during IME composition (e.g. Japanese/Chinese/Korean or keyCode 229) -> confirms candidate, never submit
assert.deepStrictEqual(
  simulateKeyDown({ key: "Enter", shiftKey: false, isComposing: true }, { enterInsertsNewline: false, isComposing: true }),
  { shouldSubmit: false, reason: "ime-composing" }
);
assert.deepStrictEqual(
  simulateKeyDown({ key: "Enter", shiftKey: false, keyCode: 229 }, { enterInsertsNewline: false, isComposing: false }),
  { shouldSubmit: false, reason: "ime-composing" }
);

// Enter on mobile/touch keyboard where enterInsertsNewline is true -> newline, never submit
assert.deepStrictEqual(
  simulateKeyDown({ key: "Enter", shiftKey: false, isComposing: false }, { enterInsertsNewline: true, isComposing: false }),
  { shouldSubmit: false, reason: "mobile-newline" }
);

console.log("PASS: Chat Keyboard & IME Behavior tests");

// 5. MESSAGE EDITING & CONVERSATION INTEGRITY TESTS
console.log("\n--- TEST GROUP 5: Message Editing & Conversation History ---");

function validateEditPayload(body) {
  if (!body || typeof body.message !== "string" || body.message.trim().length === 0) {
    return { valid: false, error: "Message text is required." };
  }
  if (body.message.length > 2000) {
    return { valid: false, error: "Message must be 2000 characters or fewer." };
  }
  return { valid: true, message: body.message.trim() };
}

assert.strictEqual(validateEditPayload({ message: "   " }).valid, false);
assert.strictEqual(validateEditPayload({ message: "Updated message content" }).valid, true);
assert.strictEqual(validateEditPayload({ message: "a".repeat(2001) }).valid, false);

console.log("PASS: Message Editing & Conversation History tests");
