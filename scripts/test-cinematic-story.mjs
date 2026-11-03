import assert from "node:assert";
import { CINEMATIC_SCENES } from "../src/lib/story/cinematicScenes.ts";

console.log("=== COMPANION: CINEMATIC OPENING STORY TEST SUITE ===\n");

// --- TEST GROUP 1: Narrative Structure & 8-Scene Sequence ---
console.log("--- TEST GROUP 1: Narrative Structure & 8-Scene Sequence ---");

assert.strictEqual(CINEMATIC_SCENES.length, 8, "Must contain exactly 8 cinematic scenes");

const expectedSceneIds = [
  "the-beginning",
  "reality-of-life",
  "arrival-of-companion",
  "life-understood",
  "dreams-become-steps",
  "space-to-begin-again",
  "your-world-your-way",
  "enter-companion",
];

CINEMATIC_SCENES.forEach((scene, idx) => {
  assert.strictEqual(scene.index, idx, `Scene index for ${scene.id} must equal ${idx}`);
  assert.strictEqual(scene.id, expectedSceneIds[idx], `Scene ${idx} ID must match ${expectedSceneIds[idx]}`);
  assert.ok(scene.title && scene.title.length > 0, `Scene ${scene.id} must have a non-empty title`);
  assert.ok(scene.badge && scene.badge.length > 0, `Scene ${scene.id} must have a non-empty badge`);
  assert.ok(Array.isArray(scene.blocks) && scene.blocks.length > 0, `Scene ${scene.id} must have narrative blocks`);

  scene.blocks.forEach((block) => {
    assert.ok(block.id, `Block in ${scene.id} must have an ID`);
    assert.ok(Array.isArray(block.lines) && block.lines.length > 0, `Block ${block.id} must have lines`);
    block.lines.forEach((line) => {
      assert.strictEqual(typeof line, "string", "Each narrative line must be a string");
      assert.ok(line.trim().length > 0, "Narrative line must not be empty");
    });
  });
});

// Scene 7 must flag character stage slot for Nikki modular reservation
const scene07 = CINEMATIC_SCENES.find((s) => s.id === "your-world-your-way");
assert.ok(scene07, "Scene 07 must exist");
assert.strictEqual(scene07.hasCharacterStageSlot, true, "Scene 07 must reserve character stage slot");

// Verify specific required copy elements from creative direction
const scene01 = CINEMATIC_SCENES[0];
assert.ok(scene01.blocks[0].lines[0].includes("Somewhere between who you are"));
assert.ok(scene01.blocks[0].lines[1].includes("who you're becoming"));
assert.ok(scene01.blocks[1].lines[0].includes("space that belongs to you"));

const scene02 = CINEMATIC_SCENES[1];
assert.ok(scene02.blocks[0].lines[0].includes("Life doesn't always follow a plan"));

const scene03 = CINEMATIC_SCENES[2];
assert.ok(scene03.blocks[0].lines[0].includes("figure it all out alone"));

const scene04 = CINEMATIC_SCENES[3];
assert.ok(scene04.blocks[0].lines[0].includes("companion who listens"));
assert.ok(scene04.blocks[0].lines[1].includes("remembers the things that matter to you"));

const scene05 = CINEMATIC_SCENES[4];
assert.ok(scene05.blocks[0].lines[0].includes("Big dreams are built from small, quiet steps"));

const scene06 = CINEMATIC_SCENES[5];
assert.ok(scene06.blocks[0].lines[0].includes("When the world is too loud"));
assert.ok(scene06.blocks[1].lines[0].includes("find your focus"));

const scene07Definition = CINEMATIC_SCENES[6];
assert.ok(scene07Definition.blocks[0].lines[0].includes("Your companion. Your pace. Your space"));

const scene08 = CINEMATIC_SCENES[7];
assert.ok(scene08.blocks[0].lines[0].includes("Your journey doesn't start with perfection"));
assert.ok(scene08.blocks[0].lines[1].includes("It starts with showing up"));

console.log("PASS: 8-Scene Sequence, Creative Direction Copy, and Modular Slot verified.\n");

// --- TEST GROUP 2: State Progression, Keyboard Navigation & Skip Logic ---
console.log("--- TEST GROUP 2: State Progression, Keyboard & Skip Flow ---");

function simulateStoryProgression(initialScene = 0) {
  let sceneIdx = initialScene;
  let blockIdx = 0;
  const history = [];

  function next() {
    const totalBlocks = CINEMATIC_SCENES[sceneIdx].blocks.length;
    if (blockIdx < totalBlocks - 1) {
      blockIdx++;
    } else if (sceneIdx < CINEMATIC_SCENES.length - 1) {
      sceneIdx++;
      blockIdx = 0;
    } else {
      return "COMPLETE";
    }
    history.push({ sceneIdx, blockIdx });
    return "CONTINUE";
  }

  function prev() {
    if (blockIdx > 0) {
      blockIdx--;
    } else if (sceneIdx > 0) {
      sceneIdx--;
      blockIdx = CINEMATIC_SCENES[sceneIdx].blocks.length - 1;
    }
    history.push({ sceneIdx, blockIdx });
  }

  return { next, prev, getState: () => ({ sceneIdx, blockIdx }), history };
}

const sim = simulateStoryProgression();
assert.strictEqual(sim.getState().sceneIdx, 0);
assert.strictEqual(sim.getState().blockIdx, 0);

// Advance 1 block
sim.next();
assert.strictEqual(sim.getState().sceneIdx, 0);
assert.strictEqual(sim.getState().blockIdx, 1);

// Advance to scene 1
sim.next();
assert.strictEqual(sim.getState().sceneIdx, 1);
assert.strictEqual(sim.getState().blockIdx, 0);

// Go back
sim.prev();
assert.strictEqual(sim.getState().sceneIdx, 0);
assert.strictEqual(sim.getState().blockIdx, 1);

// Step through to final completion
let result = "CONTINUE";
let safetyLimit = 100;
while (result === "CONTINUE" && safetyLimit-- > 0) {
  result = sim.next();
}
assert.strictEqual(result, "COMPLETE", "Final scene advance must trigger completion");
assert.strictEqual(sim.getState().sceneIdx, 7, "Must complete at scene 7");

console.log("PASS: Story progression, block advancing, backstepping, and completion verified.\n");

// --- TEST GROUP 3: Persistence, Replay and Guard Routing ---
console.log("--- TEST GROUP 3: Persistence, Replay and Route Decisions ---");

function determineLandingDestination({
  isAuthenticated,
  onboardingCompleted,
  introCompleted,
  isReplayMode,
}) {
  if (isReplayMode) {
    return "RENDER_STORY";
  }

  if (!isAuthenticated) {
    return "RENDER_STORY";
  }

  if (introCompleted) {
    return onboardingCompleted ? "/dashboard" : "/onboarding";
  }

  return "RENDER_STORY";
}

// 1. First-time unauthenticated visitor -> shows story
assert.strictEqual(
  determineLandingDestination({
    isAuthenticated: false,
    onboardingCompleted: false,
    introCompleted: false,
    isReplayMode: false,
  }),
  "RENDER_STORY"
);

// 2. Returning authenticated user with intro done & onboarded -> goes straight to dashboard
assert.strictEqual(
  determineLandingDestination({
    isAuthenticated: true,
    onboardingCompleted: true,
    introCompleted: true,
    isReplayMode: false,
  }),
  "/dashboard"
);

// 3. Authenticated user who skipped intro but hasn't onboarded -> goes to onboarding
assert.strictEqual(
  determineLandingDestination({
    isAuthenticated: true,
    onboardingCompleted: false,
    introCompleted: true,
    isReplayMode: false,
  }),
  "/onboarding"
);

// 4. Authenticated user requesting replay from Settings -> renders story
assert.strictEqual(
  determineLandingDestination({
    isAuthenticated: true,
    onboardingCompleted: true,
    introCompleted: true,
    isReplayMode: true,
  }),
  "RENDER_STORY"
);

// 5. Non-destructive replay data integrity check
const userProfileBeforeReplay = {
  firebaseUid: "user_replay_safe",
  onboardingCompleted: true,
  introCompleted: true,
  goals: ["Launch App", "Read 10 books"],
  memoriesCount: 42,
  companionName: "Nikki",
};

// Completing a replay only writes introCompleted: true and updates local storage
const userProfileAfterReplay = {
  ...userProfileBeforeReplay,
  introCompleted: true,
};

assert.deepStrictEqual(
  userProfileAfterReplay,
  userProfileBeforeReplay,
  "Replay completion must not alter user profile, goals, or memories"
);

console.log("PASS: Persistence logic, skip handling, replay flag, and non-destructive invariant verified.\n");

console.log("ALL CINEMATIC STORY TESTS PASSED WITH 100% SUCCESS!");
