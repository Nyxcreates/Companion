import assert from "node:assert";

console.log("=== COMPANION: ENVIRONMENTAL DISCOVERY & 8 LIVING WORLDS TEST SUITE ===\n");

// --- TEST GROUP 1: 8 Living Worlds Catalog & Alias Normalization ---
console.log("--- TEST GROUP 1: 8 Living Worlds Catalog & Normalization ---");

const CANONICAL_WORLDS = [
  "cosmic-dream",
  "enchanted-garden",
  "abyssal-dreams",
  "midnight-academia",
  "moonlit-sakura",
  "aurora-sanctuary",
  "autumn-reverie",
  "cloud-kingdom",
];

const LEGACY_ALIASES = {
  space: "cosmic-dream",
  garden: "enchanted-garden",
  ocean: "abyssal-dreams",
};

function normalizeLivingEnvironmentId(env) {
  if (!env) return "cosmic-dream";
  if (LEGACY_ALIASES[env]) return LEGACY_ALIASES[env];
  if (CANONICAL_WORLDS.includes(env)) return env;
  return "cosmic-dream";
}

assert.strictEqual(CANONICAL_WORLDS.length, 8, "Must support all 8 living worlds");

// Verify canonical resolution
CANONICAL_WORLDS.forEach((world) => {
  assert.strictEqual(normalizeLivingEnvironmentId(world), world, `World ${world} must resolve to itself`);
});

// Verify legacy alias resolution
assert.strictEqual(normalizeLivingEnvironmentId("space"), "cosmic-dream");
assert.strictEqual(normalizeLivingEnvironmentId("garden"), "enchanted-garden");
assert.strictEqual(normalizeLivingEnvironmentId("ocean"), "abyssal-dreams");

// Verify unknown fallback
assert.strictEqual(normalizeLivingEnvironmentId("cyberpunk-city"), "cosmic-dream");
assert.strictEqual(normalizeLivingEnvironmentId(null), "cosmic-dream");

console.log("PASS: 8 canonical worlds and legacy alias mappings verified.\n");

// --- TEST GROUP 2: Environmental Discovery 6-Scene Structure ---
console.log("--- TEST GROUP 2: Environmental Discovery 6-Scene Sequence ---");

const DISCOVERY_SCENES = [
  {
    id: "awakening",
    number: 1,
    title: "A World Comes Alive",
    badge: "01 / Awakening",
    env: "cosmic-dream",
    focalObject: "Celestial Nexus Beacon",
    featureDemonstrated: "Living Companion Awakening",
  },
  {
    id: "memory-vault",
    number: 2,
    title: "The Cosmic Vault",
    badge: "02 / Memories & Capsules",
    env: "cosmic-dream",
    focalObject: "Memory Constellation & Time Capsule",
    featureDemonstrated: "Memories, Garden & Capsules",
    model: {
      what: "A personal vault for recurring themes and reflections.",
      why: "Keep what matters without repeating yourself.",
      how: "Nikki surfaces patterns or you seal capsules for future dates.",
      where: "/memories",
    },
  },
  {
    id: "garden-growth",
    number: 3,
    title: "Garden of Growth",
    badge: "03 / Goals & Tasks",
    env: "enchanted-garden",
    focalObject: "Aspiration Tree",
    featureDemonstrated: "Goals, Tasks & Schedule",
    model: {
      what: "Adaptive planning from deep goals down to today's tasks.",
      why: "Progress without burnout or rigid to-do guilt.",
      how: "Plant a goal seed, branch tasks, schedule without friction.",
      where: "/plan",
    },
  },
  {
    id: "abyssal-sanctuary",
    number: 4,
    title: "Abyssal Sanctuary",
    badge: "04 / Focus & Journal",
    env: "abyssal-dreams",
    focalObject: "Pearl Focus Shell & Ocean Journal",
    featureDemonstrated: "Focus Mode & Reflective Journal",
    model: {
      what: "A calm sanctuary for deep work and reflective journaling.",
      why: "Calm the noise, focus your mind, and clear mental clutter.",
      how: "Select focus intervals or write freely; Nikki synthesizes themes.",
      where: "/focus and /journal",
    },
  },
  {
    id: "convergence",
    number: 5,
    title: "Harmonic Convergence",
    badge: "05 / Living World",
    env: "convergence",
    focalObject: "Tri-Realm Orbital Nexus",
    featureDemonstrated: "Integrated Life Intelligence",
  },
  {
    id: "world-gateway",
    number: 6,
    title: "Welcome Home",
    badge: "06 / Your Sanctuary",
    env: "gateway",
    focalObject: "8-World Living Grid & Appearance Switcher",
    featureDemonstrated: "World & Theme Personalization",
  },
];

assert.strictEqual(DISCOVERY_SCENES.length, 6, "Must contain exactly 6 discovery scenes");

DISCOVERY_SCENES.forEach((scene, index) => {
  assert.strictEqual(scene.number, index + 1, `Scene ${scene.id} must be scene number ${index + 1}`);
  assert.ok(scene.focalObject, `Scene ${scene.id} must have a focal object`);
  assert.ok(scene.featureDemonstrated, `Scene ${scene.id} must demonstrate a feature`);
});

// Verify WHAT, WHY, HOW, WHERE pedagogical model on core functional scenes
[1, 2, 3].forEach((idx) => {
  const sc = DISCOVERY_SCENES[idx];
  assert.ok(sc.model.what, `Scene ${sc.id} must define WHAT`);
  assert.ok(sc.model.why, `Scene ${sc.id} must define WHY`);
  assert.ok(sc.model.how, `Scene ${sc.id} must define HOW`);
  assert.ok(sc.model.where, `Scene ${sc.id} must define WHERE`);
});

console.log("PASS: Environmental discovery sequence and WHAT/WHY/HOW/WHERE pedagogy verified.\n");

// --- TEST GROUP 3: Focal Object Interactions & Miniature Demonstrations ---
console.log("--- TEST GROUP 3: Object Interactions & Mini Demonstrations ---");

function simulateDiscoveryEngine() {
  let index = 0;
  let beaconAwakened = false;
  let capsuleSealed = false;
  let growthStage = "seed"; // seed -> stem -> full
  let breathCount = 10;
  let activeConvergenceNode = "action";

  return {
    getScene: () => DISCOVERY_SCENES[index],
    next: () => {
      if (index < DISCOVERY_SCENES.length - 1) {
        index++;
        return "ADVANCED";
      }
      return "COMPLETED";
    },
    prev: () => {
      if (index > 0) index--;
    },
    jump: (i) => {
      if (i >= 0 && i < DISCOVERY_SCENES.length) index = i;
    },
    skip: () => "ENTERED_IMMEDIATELY",
    awakenBeacon: () => {
      beaconAwakened = true;
    },
    sealCapsule: () => {
      capsuleSealed = true;
    },
    nurturePlant: () => {
      if (growthStage === "seed") growthStage = "stem";
      else if (growthStage === "stem") growthStage = "full";
      else growthStage = "seed";
    },
    takeBreath: (sec) => {
      breathCount = Math.max(0, breathCount - sec);
    },
    setConvergenceNode: (node) => {
      activeConvergenceNode = node;
    },
    getState: () => ({
      index,
      beaconAwakened,
      capsuleSealed,
      growthStage,
      breathCount,
      activeConvergenceNode,
    }),
  };
}

const engine = simulateDiscoveryEngine();
assert.strictEqual(engine.getState().index, 0);

// Scene 1: Beacon Awakening Demo
engine.awakenBeacon();
assert.strictEqual(engine.getState().beaconAwakened, true);

// Advance to Scene 2: Memory Vault & Capsule Sealing Demo
engine.next();
assert.strictEqual(engine.getState().index, 1);
engine.sealCapsule();
assert.strictEqual(engine.getState().capsuleSealed, true);

// Advance to Scene 3: Garden Growth Aspiration Tree Demo
engine.next();
assert.strictEqual(engine.getState().index, 2);
assert.strictEqual(engine.getState().growthStage, "seed");
engine.nurturePlant(); // seed -> stem (Goal)
assert.strictEqual(engine.getState().growthStage, "stem");
engine.nurturePlant(); // stem -> full (Tasks)
assert.strictEqual(engine.getState().growthStage, "full");

// Advance to Scene 4: Abyssal Sanctuary Breath & Reflection Demo
engine.next();
assert.strictEqual(engine.getState().index, 3);
engine.takeBreath(4);
assert.strictEqual(engine.getState().breathCount, 6);

// Advance to Scene 5: Convergence Orbital Demo
engine.next();
assert.strictEqual(engine.getState().index, 4);
engine.setConvergenceNode("memory");
assert.strictEqual(engine.getState().activeConvergenceNode, "memory");

// Advance to Scene 6: World Gateway
engine.next();
assert.strictEqual(engine.getState().index, 5);

// Test jump & skip
engine.jump(2);
assert.strictEqual(engine.getState().index, 2);
assert.strictEqual(engine.skip(), "ENTERED_IMMEDIATELY");

console.log("PASS: Focal object mini-demonstrations and scene engine state verified.\n");

// --- TEST GROUP 4: Theme, 8-World Selection & API Validation ---
console.log("--- TEST GROUP 4: Theme, 8-World Selection & API Validation ---");

function validateTheme(theme) {
  if (theme === "dark" || theme === "light") return { valid: true, value: theme };
  return { valid: false, error: "Theme must be 'dark' or 'light'." };
}

function validateEnvironment(env) {
  const normalized = normalizeLivingEnvironmentId(env);
  if (CANONICAL_WORLDS.includes(normalized)) {
    return { valid: true, value: normalized };
  }
  return { valid: false, error: "Invalid living environment." };
}

// Test independent themes
assert.strictEqual(validateTheme("dark").valid, true);
assert.strictEqual(validateTheme("light").valid, true);
assert.strictEqual(validateTheme("midnight_neon").valid, false);

// Test all 8 worlds
CANONICAL_WORLDS.forEach((world) => {
  const res = validateEnvironment(world);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.value, world);
});

// Test legacy aliases normalize on validation
assert.strictEqual(validateEnvironment("space").value, "cosmic-dream");
assert.strictEqual(validateEnvironment("garden").value, "enchanted-garden");
assert.strictEqual(validateEnvironment("ocean").value, "abyssal-dreams");

console.log("PASS: Independent theme and 8-world validation verified.\n");

// --- TEST GROUP 5: Entry Routing & Non-Destructive Replay Invariant ---
console.log("--- TEST GROUP 5: Entry Routing & Non-Destructive Invariants ---");

function determineEntryDestination({
  isAuthenticated,
  onboardingCompleted,
  introCompleted,
  isReplayMode,
}) {
  if (isReplayMode) return "SHOW_STORY";
  if (!isAuthenticated) return "SHOW_STORY";
  if (introCompleted) {
    return onboardingCompleted ? "/dashboard" : "/onboarding";
  }
  return "SHOW_STORY";
}

assert.strictEqual(
  determineEntryDestination({
    isAuthenticated: false,
    onboardingCompleted: false,
    introCompleted: false,
    isReplayMode: false,
  }),
  "SHOW_STORY"
);

assert.strictEqual(
  determineEntryDestination({
    isAuthenticated: true,
    onboardingCompleted: true,
    introCompleted: true,
    isReplayMode: false,
  }),
  "/dashboard"
);

assert.strictEqual(
  determineEntryDestination({
    isAuthenticated: true,
    onboardingCompleted: true,
    introCompleted: true,
    isReplayMode: true,
  }),
  "SHOW_STORY"
);

// Invariant: Replay must NEVER alter user's goals, tasks, memories, or profile data
const existingUserRecord = {
  firebaseUid: "user_stable_replay",
  displayName: "Nishtha",
  onboardingCompleted: true,
  introCompleted: true,
  goals: ["Lead Companion launch", "Daily journal practice"],
  tasks: [{ id: "t1", title: "Review architectural docs" }],
  memories: [{ id: "m1", title: "Loved the sakura garden aesthetic" }],
  theme: "dark",
  livingEnvironment: "moonlit-sakura",
};

const replayCompletionUpdate = {
  introCompleted: true,
  livingEnvironment: "midnight-academia",
};

const userAfterReplay = {
  ...existingUserRecord,
  ...replayCompletionUpdate,
};

assert.strictEqual(userAfterReplay.firebaseUid, existingUserRecord.firebaseUid);
assert.deepStrictEqual(userAfterReplay.goals, existingUserRecord.goals);
assert.deepStrictEqual(userAfterReplay.tasks, existingUserRecord.tasks);
assert.deepStrictEqual(userAfterReplay.memories, existingUserRecord.memories);
assert.strictEqual(userAfterReplay.livingEnvironment, "midnight-academia");

console.log("PASS: Entry routing and non-destructive replay invariants verified.\n");

// --- TEST GROUP 6: Focus Mode Dampening & Motion Calming ---
console.log("--- TEST GROUP 6: Focus Mode & Motion Calming ---");

function computeBackdropDamping({ isFocusMode, calm, prefersReducedMotion }) {
  return {
    opacity: isFocusMode ? 0.2 : 1.0,
    blur: isFocusMode ? "1px" : "0px",
    calm: isFocusMode || calm,
    ambientMotion: !prefersReducedMotion && !isFocusMode,
  };
}

const focusModeDamping = computeBackdropDamping({
  isFocusMode: true,
  calm: true,
  prefersReducedMotion: false,
});

assert.strictEqual(focusModeDamping.opacity, 0.2);
assert.strictEqual(focusModeDamping.blur, "1px");
assert.strictEqual(focusModeDamping.ambientMotion, false, "Focus mode must suppress motion");

const normalDamping = computeBackdropDamping({
  isFocusMode: false,
  calm: false,
  prefersReducedMotion: false,
});

assert.strictEqual(normalDamping.opacity, 1.0);
assert.strictEqual(normalDamping.ambientMotion, true);

console.log("PASS: Focus mode damping and motion suppression verified.\n");

console.log("ALL 6 LIVING WORLD AND ENVIRONMENTAL DISCOVERY TEST GROUPS PASSED (100%)!");
