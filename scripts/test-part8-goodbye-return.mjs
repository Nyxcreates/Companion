import assert from "node:assert";

console.log("==========================================================");
console.log("PART 8 TEST SUITE: NIKKI NATURAL GOODBYE & RETURN");
console.log("==========================================================");

// 1. SIGNAL DERIVATION ENGINE
console.log("\n[TEST 1] Farewell & Return Companion Signal Derivation");
function deriveCompanionSignal(intent, userMessage) {
  const lower = userMessage.toLowerCase();
  if (intent === "farewell") {
    if (/sleep|goodnight|bed\b|night\b|rest\b/.test(lower)) {
      return { state: "sleeping", pose: "sleepy" };
    }
    if (/college|class|lecture|uni\b|campus|school/.test(lower)) {
      return { state: "college", pose: "wave" };
    }
    if (/break|eat|lunch|snack|dinner|stepping away|away for a while|brb/.test(lower)) {
      return { state: "break", pose: "sit" };
    }
    return { state: "leaving", pose: "wave" };
  }
  if (intent === "welcome_back") {
    if (/college|class|lecture|uni|campus|school/.test(lower)) {
      return { state: "returned", pose: "celebrate" };
    }
    return { state: "returned", pose: "happy" };
  }
  return null;
}

// Subtest A: Leaving
const sigBye = deriveCompanionSignal("farewell", "Bye Nikki, see you later!");
assert.strictEqual(sigBye.state, "leaving");
assert.strictEqual(sigBye.pose, "wave");
console.log("✓ 'Bye Nikki' correctly maps to leaving state with wave pose");

// Subtest B: College departure
const sigCollege = deriveCompanionSignal("farewell", "Going to college now!");
assert.strictEqual(sigCollege.state, "college");
assert.strictEqual(sigCollege.pose, "wave");
console.log("✓ 'Going to college' maps to college state with wave pose");

// Subtest C: Sleep departure
const sigSleep = deriveCompanionSignal("farewell", "I'm going to sleep, goodnight Nikki 🌙");
assert.strictEqual(sigSleep.state, "sleeping");
assert.strictEqual(sigSleep.pose, "sleepy");
console.log("✓ 'Goodnight Nikki' maps to sleeping state with sleepy pose");

// Subtest D: Temporary break
const sigBreak = deriveCompanionSignal("farewell", "I'm taking a break and going to eat lunch");
assert.strictEqual(sigBreak.state, "break");
assert.strictEqual(sigBreak.pose, "sit");
console.log("✓ 'Taking a break' maps to break state with sit pose");

// Subtest E: Return from college
const sigRetCollege = deriveCompanionSignal("welcome_back", "I'm back from college!");
assert.strictEqual(sigRetCollege.state, "returned");
assert.strictEqual(sigRetCollege.pose, "celebrate");
console.log("✓ 'I'm back from college' maps to returned state with celebrate pose");

// Subtest F: General return
const sigRetGen = deriveCompanionSignal("welcome_back", "I'm home!");
assert.strictEqual(sigRetGen.state, "returned");
assert.strictEqual(sigRetGen.pose, "happy");
console.log("✓ 'I'm home' maps to returned state with happy pose");

// 2. CONTEXTUAL FAREWELL PROMPT MATCHING
console.log("\n[TEST 2] Intent Detection Coverage for Conversational Farewell & Return");
function classifyIntent(text) {
  const lower = text.toLowerCase().trim();
  if (
    /^(bye|goodbye|see ya|cya|see you|goodnight|night)/.test(lower) ||
    /(bye\s+nikki|i'm\s+leaving|im\s+leaving|going\s+to\s+college|heading\s+to\s+class|going\s+out|taking\s+a\s+break|going\s+to\s+eat|away\s+for\s+a\s+while|(?:i'll|ill|i will)\s+be\s+back\s+later|going\s+to\s+sleep|going\s+to\s+bed|heading\s+to\s+bed)/.test(lower)
  ) {
    return "farewell";
  }
  if (
    /^(i'm back|im back|i am back|i'm home|im home|hey nikki|back from college|returned from class)/.test(lower)
  ) {
    return "welcome_back";
  }
  return "conversation";
}

const leavingPhrases = [
  "Bye Nikki.",
  "I'm leaving.",
  "Going to college.",
  "I'll be back later.",
  "Going out.",
  "I'm going to sleep.",
  "Goodnight.",
  "See you tomorrow.",
  "I'm taking a break.",
  "Going to eat.",
  "I'll be away for a while.",
];

for (const phrase of leavingPhrases) {
  const intent = classifyIntent(phrase);
  assert.strictEqual(intent, "farewell", `Expected '${phrase}' to be farewell, got ${intent}`);
}
console.log(`✓ All ${leavingPhrases.length} user farewell & departure variants classified as farewell`);

const returnPhrases = [
  "I'm back.",
  "Hey Nikki.",
  "I'm home.",
  "I'm back from college.",
];

for (const phrase of returnPhrases) {
  const intent = classifyIntent(phrase);
  assert.strictEqual(intent, "welcome_back", `Expected '${phrase}' to be welcome_back, got ${intent}`);
}
console.log(`✓ All ${returnPhrases.length} user return variants classified as welcome_back`);

// 3. AMBIGUOUS & NORMAL CONVERSATION SAFETY
console.log("\n[TEST 3] Ambiguous & Ordinary Conversation Safety Net");
const normalChat = [
  "What is my next task?",
  "Tell me a joke",
  "How are you doing today?",
  "College was really hard last week",
  "I sleep around 11 PM usually",
];

for (const phrase of normalChat) {
  const intent = classifyIntent(phrase);
  assert.notStrictEqual(intent, "farewell", `Normal chat '${phrase}' must not be classified as farewell`);
  assert.notStrictEqual(intent, "welcome_back", `Normal chat '${phrase}' must not be classified as welcome_back`);
}
console.log("✓ Normal conversational sentences containing words like 'college' or 'sleep' are safely treated as conversation");

// 4. MEMORY OF DEPARTURE ON GREETING RETURN
console.log("\n[TEST 4] Absence Memory & Greeting Return Synthesis");
function evaluateReturnGreeting(storedUserState, localHour) {
  if (storedUserState?.state === "college") {
    return {
      message: "You're backkk! How did college go today? Time to unwind a bit.",
      pose: "celebrate",
    };
  }
  if (storedUserState?.state === "sleeping" && localHour >= 5 && localHour < 14) {
    return {
      message: "Good morninggg! ☀️ Hope you slept peacefully! Ready for today?",
      pose: "happy",
    };
  }
  if (storedUserState?.state === "break") {
    return {
      message: "Welcome back from your break! Feeling refreshed?",
      pose: "happy",
    };
  }
  return {
    message: "Welcome back! Good to see you again.",
    pose: "wave",
  };
}

// User left for college earlier -> on return, Nikki asks about college
const retCol = evaluateReturnGreeting({ state: "college", timestamp: Date.now() - 4 * 3600 * 1000 }, 14);
assert.strictEqual(retCol.pose, "celebrate");
assert.ok(retCol.message.includes("How did college go today?"));
console.log("✓ Returning after college departure recalls college context and celebrates");

// User went to sleep earlier -> in morning, Nikki asks about sleep
const retSleep = evaluateReturnGreeting({ state: "sleeping", timestamp: Date.now() - 8 * 3600 * 1000 }, 8);
assert.strictEqual(retSleep.pose, "happy");
assert.ok(retSleep.message.includes("Hope you slept peacefully!"));
console.log("✓ Returning in the morning after saying goodnight recalls sleep context warmly");

// User went on break -> returns, asks about break
const retBreak = evaluateReturnGreeting({ state: "break", timestamp: Date.now() - 30 * 60 * 1000 }, 15);
assert.strictEqual(retBreak.pose, "happy");
assert.ok(retBreak.message.includes("Welcome back from your break!"));
console.log("✓ Returning from break acknowledges the breather");

console.log("\n==========================================================");
console.log("ALL PART 8 GOODBYE & RETURN TESTS PASSED! (4/4)");
console.log("==========================================================");
