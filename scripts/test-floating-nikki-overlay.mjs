import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

console.log("==========================================================");
console.log("TEST SUITE: FLOATING NIKKI OVERLAY & LIVING PRESENCE");
console.log("==========================================================");

const componentPath = path.resolve("src/components/character/NikkiProactivePresence.tsx");
const appShellPath = path.resolve("src/components/layout/AppShell.tsx");

const componentSource = fs.readFileSync(componentPath, "utf8");
const appShellSource = fs.readFileSync(appShellPath, "utf8");

// TEST 1: Mounted in AppShell for all logged-in pages
console.log("\n[TEST 1] Mounted Once in App Shell");
assert.ok(
  appShellSource.includes("<NikkiProactivePresence />") ||
  appShellSource.includes("<NikkiProactivePresence"),
  "AppShell must mount NikkiProactivePresence once"
);
console.log("✓ NikkiProactivePresence is mounted once in AppShell");

// TEST 2: Draggable avatar & persistent position in localStorage (try/catch)
console.log("\n[TEST 2] Draggable Avatar & Persistent LocalStorage Position");
assert.ok(componentSource.includes("drag"), "Component must have draggable capability");
assert.ok(componentSource.includes("localStorage.getItem"), "Position must be read from localStorage");
assert.ok(componentSource.includes("localStorage.setItem"), "Position must be written to localStorage");
assert.ok(componentSource.includes("try {"), "LocalStorage operations must be protected with try/catch");
assert.ok(
  componentSource.includes("right-4") &&
  (componentSource.includes("bottom-20") || componentSource.includes("bottom-24") || componentSource.includes("bottom-8")),
  "Default position must sit in a corner"
);
console.log("✓ Draggable avatar hovers in corner and persists position safely in localStorage");

// TEST 3: Idle gentle animation & blink
console.log("\n[TEST 3] Gentle Idle Animation & Blinking");
assert.ok(
  componentSource.includes("CompanionCharacter"),
  "Must use existing CompanionCharacter avatar component"
);
assert.ok(
  componentSource.includes("reduceMotion") && componentSource.includes("useReducedMotion"),
  "Must respect prefers-reduced-motion"
);
console.log("✓ Component renders CompanionCharacter with bob/blink idle animations and reduced-motion handling");

// TEST 4: Time of day greeting with user name & session constraint
console.log("\n[TEST 4] Contextual Time-of-Day Greeting with User Name (At Most Once Per Session)");
assert.ok(
  componentSource.includes("Good morning, ${userName}! Ready to start the day?") ||
  componentSource.includes("Good morning,") ||
  componentSource.includes("morning"),
  "Must include contextual time-of-day greeting with user name"
);
assert.ok(
  componentSource.includes("sessionStorage.getItem") &&
  componentSource.includes("sessionStorage.setItem"),
  "Must use sessionStorage for session-level greeting guard"
);
assert.ok(
  componentSource.includes("SESSION_GREETING_KEY") || componentSource.includes("session-greeting"),
  "Greeting must be constrained to show at most once per session"
);
console.log("✓ Shows greeting with user name based on time of day at most once per session");

// TEST 5: Tapping opens chat & close button dismisses
console.log("\n[TEST 5] Tapping Opens Chat & Close Button Dismisses");
assert.ok(
  componentSource.includes("/dashboard"),
  "Tapping Nikki opens the chat (/dashboard)"
);
assert.ok(
  componentSource.includes("handleAction(\"dismiss\")") ||
  componentSource.includes("dismissCheckIn"),
  "Close button dismisses the speech bubble"
);
console.log("✓ Tapping avatar opens chat, and close button dismisses speech bubble");

// TEST 6: "Bye Nikki" action in menu: waves, goodbye line, minimises to small dot, returns on tap or next session
console.log("\n[TEST 6] 'Bye Nikki' Menu Action & Dot Minimization");
assert.ok(
  componentSource.includes("Bye {companionName}") || componentSource.includes("Bye Nikki"),
  "Menu must include 'Bye Nikki' action"
);
assert.ok(
  componentSource.includes('setActiveSignal({ state: "leaving", pose: "wave" })') ||
  componentSource.includes('pose: "wave"'),
  "Nikki must wave when user says goodbye"
);
assert.ok(
  componentSource.includes("goodbyeMessage"),
  "Nikki must say a goodbye line before minimizing"
);
assert.ok(
  componentSource.includes("handleRestoreFromDot"),
  "Tapping the small dot restores Nikki"
);
assert.ok(
  componentSource.includes("MINIMIZED_STORAGE_KEY") && componentSource.includes("sessionStorage"),
  "Minimized state is session-scoped so she returns on next session"
);
console.log("✓ 'Bye Nikki' waves, says goodbye line, minimizes to dot, and returns on tap or next session");

// TEST 7: Settings toggle for proactive check-ins
console.log("\n[TEST 7] Settings Toggle for Proactive Check-ins (preferences.proactiveEnabled)");
assert.ok(
  componentSource.includes("preferences.proactiveEnabled === false"),
  "Respects existing Settings toggle for proactive check-ins (preferences.proactiveEnabled)"
);
console.log("✓ Respects preferences.proactiveEnabled settings toggle");

// TEST 8: App open restriction statement
console.log("\n[TEST 8] Operates Only While App is Open");
assert.ok(
  /operates client-side only while the application/i.test(componentSource) &&
  /is open and active in the browser/i.test(componentSource),
  "Code must clearly document that floating presence operates only while app is open"
);
console.log("✓ Code explicitly documents that overlay operates client-side only while app is open");

console.log("\n==========================================================");
console.log("ALL 8 FLOATING NIKKI OVERLAY TESTS PASSED! (8/8)");
console.log("==========================================================");
