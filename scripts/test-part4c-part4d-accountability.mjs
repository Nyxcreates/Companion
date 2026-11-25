import assert from "node:assert";
import { decideNikkiNudge } from "../src/lib/nikki/decide.ts";
import {
  getPersonaFallbackMessage,
  buildNikkiScenarioPrompt,
} from "../src/lib/nikki/persona.ts";
import {
  parseAccountabilityIntent,
  generateDefaultSubSteps,
} from "../src/lib/nikki/accountabilitySupport.ts";

console.log("==========================================================================");
console.log("TEST SUITE: NIKKI PART 4C (PROACTIVE CONVERSATIONS) & PART 4D (INTERACTIVE SUPPORT)");
console.log("==========================================================================");

/** Helper to generate baseline context */
function createBaseContext(overrides = {}) {
  const currentHour = overrides.currentHour ?? 14;
  const currentMinute = overrides.currentMinute ?? 0;
  const totalMinutes = overrides.totalMinutes ?? (currentHour * 60 + currentMinute);
  const localTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  return {
    firebaseUid: "user_test_4cd",
    userName: "Nishtha",
    companionName: "Nikki",
    timezone: "Asia/Kolkata",
    localTime,
    localDate: "2026-11-13",
    currentHour,
    currentMinute,
    totalMinutes,

    quietHoursStart: "22:30",
    quietHoursEnd: "07:00",
    isQuietHours: false,
    isPaused: false,
    pausedUntil: null,
    proactiveEnabled: true,
    strictness: "playful",
    checkInFrequency: "balanced",

    hasScheduleToday: true,
    scheduleItems: [],
    unstartedStartedItems: [],
    missedActivities: [],
    completedActivitiesCountToday: 0,
    completedTasksCountToday: 0,

    activeGoals: [],
    completedGoals: [],
    allGoals: [],
    overdueGoals: [],
    staleGoals: [],
    neglectedGoals: [],
    highPriorityNeglectedGoals: [],
    goalsMakingGoodProgress: [],

    pendingTasks: [],
    completedTasks: [],
    incompleteTasks: [],
    overdueTasks: [],
    staleTasks: [],
    postponedTasks: [],
    repeatedlyPostponedTasks: [],
    importantUnfinishedTasks: [],
    approachingDeadlineTasks: [],
    avoidanceHistory: {},
    totalPendingTasksCount: 0,

    lastUserMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    minutesSinceLastUserMessage: 120,
    lastConversationTopic: null,
    memories: [],

    lastFocusSession: null,
    isFocusSessionJustFinished: false,
    activeFocusSession: null,
    recentJournalEntry: null,

    lastNudge: null,
    recentNudgeOutcomes: [],
    consecutiveIgnoredOrDismissedNudges: 0,
    nudgesSentTodayCount: 0,

    recentMoods: [],
    hydrationCountToday: 1,
    breakCountToday: 1,

    lastSeenAt: new Date(Date.now() - 5 * 60 * 1000),
    minutesSinceLastSeen: 5,
    isFirstOpenOfDay: false,
    isReturningAfterAbsence: false,
    isLongContinuousSession: false,
    usualBedtime: "23:00",
    usualWakeTime: "07:30",
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 4C: PROACTIVE ACCOUNTABILITY CONVERSATIONS
// ═════════════════════════════════════════════════════════════════════════════

console.log("\n─── PART 4C: PROACTIVE ACCOUNTABILITY CONVERSATIONS ───");

// [4C-TEST 1] Proactive initiation for untouched goal
console.log("\n[4C-TEST 1] Proactive initiation for untouched goal");
{
  const neglectedGoal = {
    id: "g_proj",
    title: "Final Year Project",
    priority: "HIGH",
    daysSinceUpdated: 4,
    avoidCount: 0,
    progressPercent: 15,
  };

  const context = createBaseContext({
    currentHour: 15,
    neglectedGoals: [neglectedGoal],
    highPriorityNeglectedGoals: [neglectedGoal],
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "goal_neglected");
  assert.strictEqual(decision.triggerContext?.goalTitle, "Final Year Project");

  // Verify speech generation references actual goal and matches natural persona
  const message = getPersonaFallbackMessage(context, decision);
  assert(
    message.includes("Final Year Project"),
    "Message must reference the actual goal name"
  );
  const messageLower = message.toLowerCase();
  assert(
    messageLower.includes("touched") ||
      messageLower.includes("priority") ||
      messageLower.includes("priorities") ||
      messageLower.includes("updates") ||
      messageLower.includes("blocking"),
    `Message must match natural accountability conversation, got: "${message}"`
  );
  console.log(`✓ 4C-Test 1 passed — Proactive goal initiation: "${message}"`);
}

// [4C-TEST 2] Proactive initiation for approaching assignment deadline
console.log("\n[4C-TEST 2] Proactive initiation for approaching assignment deadline");
{
  const urgentTask = {
    id: "t_assignment",
    title: "Operating Systems Assignment",
    dueDate: new Date(Date.now() + 3.5 * 60 * 60 * 1000),
    hoursUntilDue: 3.5,
    avoidCount: 0,
  };

  const context = createBaseContext({
    currentHour: 11,
    approachingDeadlineTasks: [urgentTask],
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "deadline_approaching");
  assert.strictEqual(decision.triggerContext?.taskTitle, "Operating Systems Assignment");

  const message = getPersonaFallbackMessage(context, decision);
  assert(
    message.includes("Operating Systems Assignment"),
    "Message must reference the actual task name"
  );
  const msgLower2 = message.toLowerCase();
  assert(
    msgLower2.includes("deadline") ||
      msgLower2.includes("approaching") ||
      msgLower2.includes("together") ||
      msgLower2.includes("due"),
    `Message must reference approaching deadline supportively, got: "${message}"`
  );
  console.log(`✓ 4C-Test 2 passed — Proactive deadline initiation: "${message}"`);
}

// [4C-TEST 3] Proactive initiation for repeatedly postponed task (caring frustration)
console.log("\n[4C-TEST 3] Proactive initiation for repeatedly postponed task");
{
  const postponedTask = {
    id: "t_postponed",
    title: "Machine Learning Paper",
    status: "PENDING",
    dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isOverdue: true,
    daysOverdue: 1,
    daysSinceUpdated: 3,
    avoidCount: 2,
    postponeCount: 3,
    isPostponed: true,
  };

  const context = createBaseContext({
    currentHour: 14,
    overdueTasks: [postponedTask],
    repeatedlyPostponedTasks: [postponedTask],
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "task_overdue");
  assert.strictEqual(decision.triggerContext?.isCaringFrustration, true);

  const message = getPersonaFallbackMessage(context, decision);
  assert(
    message.includes("Machine Learning Paper"),
    "Message must reference the actual postponed task"
  );
  const msgLower3 = message.toLowerCase();
  assert(
    msgLower3.includes("postponed") ||
      msgLower3.includes("avoided") ||
      msgLower3.includes("pushed") ||
      msgLower3.includes("nemesis") ||
      msgLower3.includes("easier to start"),
    `Message must reflect caring accountability for repeatedly postponed task, got: "${message}"`
  );
  console.log(`✓ 4C-Test 3 passed — Caring frustration initiation: "${message}"`);
}

// [4C-TEST 4] Proactive celebration on completed progress
console.log("\n[4C-TEST 4] Proactive celebration on completed progress");
{
  const context = createBaseContext({
    currentHour: 16,
    completedTasksCountToday: 3,
  });

  const decision = decideNikkiNudge(context);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "task_celebration");

  const message = getPersonaFallbackMessage(context, decision);
  const msgLower = message.toLowerCase();
  assert(
    message.includes("WAITTT!") ||
      msgLower.includes("completed") ||
      msgLower.includes("proud") ||
      msgLower.includes("done") ||
      msgLower.includes("progress"),
    `Message must celebrate task momentum, got: "${message}"`
  );
  console.log(`✓ 4C-Test 4 passed — Proactive momentum celebration: "${message}"`);
}

// [4C-TEST 5] Protection & Boundaries (Quiet hours, Snooze, 7-day uniqueness)
console.log("\n[4C-TEST 5] Protection & Boundaries");
{
  // 1. Quiet hours protection
  const quietContext = createBaseContext({
    isQuietHours: true,
    approachingDeadlineTasks: [
      { id: "t1", title: "Test Task", hoursUntilDue: 2, dueDate: new Date() },
    ],
  });
  const quietDecision = decideNikkiNudge(quietContext);
  assert.strictEqual(quietDecision.shouldSpeak, false);
  assert(quietDecision.reason.includes("Quiet hours"));

  // 2. Snoozing / Muting protection (isPaused)
  const pausedContext = createBaseContext({
    isPaused: true,
    overdueTasks: [{ id: "t2", title: "Test Task", isOverdue: true, daysOverdue: 1, avoidCount: 0 }],
  });
  const pausedDecision = decideNikkiNudge(pausedContext);
  assert.strictEqual(pausedDecision.shouldSpeak, false);
  assert(pausedDecision.reason.includes("paused"));

  // 3. 7-day uniqueness: fallback filters out recent messages verbatim
  const promptContext = createBaseContext();
  const testDecision = {
    shouldSpeak: true,
    trigger: "task_celebration",
    idempotencyKey: "test_key",
    reason: "Test celebration",
    triggerContext: { completedCount: 3 },
  };

  const sentMessage = `WAITTT! You actually completed it! I'm proud of you, Nishtha! 🎉`;
  const recentMessagesSet = new Set([sentMessage]);

  const candidateMessage = getPersonaFallbackMessage(promptContext, testDecision, recentMessagesSet);
  assert.notStrictEqual(
    candidateMessage,
    sentMessage,
    "Fallback message must NOT verbatim repeat a message sent in the past 7 days"
  );

  console.log("✓ 4C-Test 5 passed — Quiet hours, snooze, and 7-day verbatim uniqueness enforced.");
}

// [4C-TEST 5b] Active conversation protection & Part 4B detection integration & Gemini prompt
console.log("\n[4C-TEST 5b] Active conversation guard, Part 4B detection bridge, and Gemini prompt");
{
  // 1. Active conversation guard: don't interrupt user who chatted 3m ago with non-urgent nudge
  const activeChatContext = createBaseContext({
    minutesSinceLastUserMessage: 3,
    neglectedGoals: [
      { id: "g1", title: "Portfolio Redesign", priority: "HIGH", daysSinceUpdated: 4, avoidCount: 0, progressPercent: 10 },
    ],
  });
  const activeChatDecision = decideNikkiNudge(activeChatContext);
  assert.strictEqual(activeChatDecision.shouldSpeak, false);
  assert(activeChatDecision.reason.includes("Active conversation"));

  // 2. Part 4B goalTaskDetections integration: repeatedly postponed task without overdue/stale
  const detectionContext = createBaseContext({
    currentHour: 14,
    goalTaskDetections: {
      detections: [],
      importantGoalsNoProgress: [],
      tasksApproachingDeadline: [],
      overdueTasks: [],
      tasksRepeatedlyPostponed: [
        {
          type: "task_repeatedly_postponed",
          severity: "warning",
          targetId: "t_postponed_4b",
          targetTitle: "Resume Update",
          summary: "Task 'Resume Update' postponed 3 times.",
          details: { postponeCount: 3 },
          dedupKey: "k1",
          cooldownHours: 24,
          detectedAt: new Date(),
        },
      ],
      goalsMakingGoodProgress: [],
      unrealisticWorkloads: [],
      hasDetections: true,
      totalCount: 1,
    },
  });
  const detectionDecision = decideNikkiNudge(detectionContext);
  assert.strictEqual(detectionDecision.shouldSpeak, true);
  assert.strictEqual(detectionDecision.trigger, "task_overdue");
  assert.strictEqual(detectionDecision.triggerContext?.targetTitle, "Resume Update");
  assert.strictEqual(detectionDecision.triggerContext?.isCaringFrustration, true);

  // 3. Gemini scenario prompt includes actual goal/task title & never-shame instructions
  const prompt = buildNikkiScenarioPrompt(detectionContext, detectionDecision);
  assert(prompt.includes("Resume Update"), "Gemini prompt must reference actual task title");
  assert(
    prompt.toLowerCase().includes("caring frustration") ||
      prompt.toLowerCase().includes("sidestepped") ||
      prompt.toLowerCase().includes("overdue"),
    "Gemini prompt must include contextual accountability guidance"
  );

  console.log("✓ 4C-Test 5b passed — Active conversation guard, Part 4B bridge, and Gemini prompt verified.");
}

// ═════════════════════════════════════════════════════════════════════════════
// PART 4D: INTERACTIVE GOAL AND TASK SUPPORT
// ═════════════════════════════════════════════════════════════════════════════

console.log("\n─── PART 4D: INTERACTIVE GOAL AND TASK SUPPORT ───");

// [4D-TEST 6] Natural response: "I have too much college work" / "I'm tired"
console.log("\n[4D-TEST 6] User responds with fatigue/overload ('I have too much college work')");
{
  const analysis = parseAccountabilityIntent("I have too much college work today", {
    targetId: "g_proj_1",
    targetTitle: "Final Year Project",
    targetType: "goal",
    userName: "Nishtha",
  });

  assert.strictEqual(analysis.intent, "rest_and_fatigue");
  assert.strictEqual(analysis.shouldModifyDatabase, false, "Rest must never corrupt database");
  assert.strictEqual(analysis.pose, "sleepy");
  assert(
    analysis.replyMessage.includes("Let's not overload you"),
    "Must respond with caring validation"
  );
  assert(
    analysis.replyMessage.includes("Rest is completely valid, not a failure"),
    "Must never treat rest as failure"
  );
  console.log(`✓ 4D-Test 6 passed — Rest acknowledged with compassion: "${analysis.replyMessage}"`);
}

// [4D-TEST 7] Natural response: "Break this task into smaller steps"
console.log("\n[4D-TEST 7] User asks to break task into smaller steps");
{
  const analysis = parseAccountabilityIntent("Can you break this task into smaller steps for me?", {
    targetId: "t_report",
    targetTitle: "Biology Lab Report",
    targetType: "task",
    userName: "Nishtha",
  });

  assert.strictEqual(analysis.intent, "break_task");
  assert(Array.isArray(analysis.proposedSteps) && analysis.proposedSteps.length >= 2);
  assert.strictEqual(analysis.shouldModifyDatabase, false, "Must require confirmation before saving");
  assert(
    analysis.replyMessage.includes("break 'Biology Lab Report' into these smaller pieces"),
    "Must explain proposed steps"
  );
  assert(
    analysis.replyMessage.includes("Just say 'yes'"),
    "Must explicitly ask for user confirmation"
  );
  console.log(`✓ 4D-Test 7 passed — Sub-steps proposed with confirmation requirement.`);
}

// [4D-TEST 8] Natural response: "Yes" (confirm proposed subtasks)
console.log("\n[4D-TEST 8] User confirms proposed subtasks ('yes please do it')");
{
  const analysis = parseAccountabilityIntent("yes please do it", {
    targetId: "t_report",
    targetTitle: "Biology Lab Report",
    targetType: "task",
    userName: "Nishtha",
  });

  assert.strictEqual(analysis.intent, "confirm_action");
  assert.strictEqual(analysis.shouldModifyDatabase, true);
  assert.strictEqual(analysis.actionToExecute, "confirm_pending");
  assert.strictEqual(analysis.pose, "celebrate");
  console.log(`✓ 4D-Test 8 passed — User confirmation detected to execute action.`);
}

// [4D-TEST 9] Natural response: "Reschedule to tomorrow" (requires confirmation)
console.log("\n[4D-TEST 9] User requests reschedule ('reschedule this to tomorrow')");
{
  const analysis = parseAccountabilityIntent("reschedule this to tomorrow please", {
    targetId: "t_tax",
    targetTitle: "Submit Tax Forms",
    targetType: "task",
    userName: "Nishtha",
  });

  assert.strictEqual(analysis.intent, "reschedule_task");
  assert.strictEqual(analysis.shouldModifyDatabase, false, "Must require user confirmation before modifying DB");
  assert.strictEqual(analysis.requiresConfirmation, true);
  assert.strictEqual(analysis.actionToExecute, "reschedule_task");
  assert.strictEqual(analysis.pendingAction?.action, "reschedule_task");
  assert(typeof analysis.newDueDate === "string");
  assert(analysis.replyMessage.includes("move 'Submit Tax Forms' to tomorrow"));
  assert(analysis.replyMessage.includes("Just say 'yes'"));
  console.log(`✓ 4D-Test 9 passed — Reschedule parsed and requires confirmation.`);
}

// [4D-TEST 10] Natural response: "I completed it!" / "Mark complete" (requires confirmation)
console.log("\n[4D-TEST 10] User announces completion ('WAITTT! Actually completed it!')");
{
  const analysis = parseAccountabilityIntent("WAITTT! I actually completed it!!", {
    targetId: "t_math",
    targetTitle: "Calculus Homework",
    targetType: "task",
    userName: "Nishtha",
  });

  assert.strictEqual(analysis.intent, "complete_item");
  assert.strictEqual(analysis.shouldModifyDatabase, false, "Must require user confirmation before modifying DB");
  assert.strictEqual(analysis.requiresConfirmation, true);
  assert.strictEqual(analysis.actionToExecute, "complete_task");
  assert.strictEqual(analysis.pendingAction?.action, "complete_task");
  assert.strictEqual(analysis.pose, "celebrate");
  assert(
    analysis.replyMessage.includes("WAITTT! You actually completed it?!"),
    "Must celebrate completion enthusiastically"
  );
  console.log(`✓ 4D-Test 10 passed — Completion celebrated and queued for confirmation.`);
}

// [4D-TEST 11] Natural response: "Make this low priority" (requires confirmation)
console.log("\n[4D-TEST 11] User changes priority ('make this low priority for now')");
{
  const analysis = parseAccountabilityIntent("make this low priority for now", {
    targetId: "t_read",
    targetTitle: "Read Article",
    targetType: "task",
    userName: "Nishtha",
  });

  assert.strictEqual(analysis.intent, "change_priority");
  assert.strictEqual(analysis.newPriority, "LOW");
  assert.strictEqual(analysis.shouldModifyDatabase, false, "Must require user confirmation before modifying DB");
  assert.strictEqual(analysis.requiresConfirmation, true);
  assert.strictEqual(analysis.actionToExecute, "change_priority");
  assert.strictEqual(analysis.pendingAction?.payload?.priority, "LOW");
  assert(analysis.replyMessage.includes("update 'Read Article' to LOW priority"));
  console.log(`✓ 4D-Test 11 passed — Priority change recognized and queued for confirmation.`);
}

// [4D-TEST 12] Natural response: "Extend goal deadline to next week" (requires confirmation)
console.log("\n[4D-TEST 12] User adjusts goal ('extend the deadline to next week')");
{
  const analysis = parseAccountabilityIntent("extend the deadline to next week", {
    targetId: "g_gre",
    targetTitle: "GRE Prep",
    targetType: "goal",
    userName: "Nishtha",
  });

  assert.strictEqual(analysis.intent, "adjust_goal");
  assert.strictEqual(analysis.shouldModifyDatabase, false, "Must require user confirmation before modifying DB");
  assert.strictEqual(analysis.requiresConfirmation, true);
  assert.strictEqual(analysis.actionToExecute, "adjust_goal");
  assert.strictEqual(analysis.pendingAction?.action, "adjust_goal");
  assert(typeof analysis.newDueDate === "string");
  assert(analysis.replyMessage.includes("update the deadline for your goal 'GRE Prep'"));
  console.log(`✓ 4D-Test 12 passed — Goal deadline adjustment queued for confirmation.`);
}

// [4D-TEST 13] Natural response: Explaining blockers ("I don't know where to start")
console.log("\n[4D-TEST 13] User explains blocker ('I'm stuck and don't know where to start')");
{
  const analysis = parseAccountabilityIntent("I'm stuck and don't know where to start with this", {
    targetId: "t_essay",
    targetTitle: "Philosophy Essay",
    targetType: "task",
    userName: "Nishtha",
  });

  assert.strictEqual(analysis.intent, "explain_blocker");
  assert.strictEqual(analysis.shouldModifyDatabase, false);
  assert.strictEqual(analysis.pose, "think");
  assert(
    analysis.replyMessage.includes("tiniest 2-minute action"),
    "Must guide towards a micro-action without shame"
  );
  console.log(`✓ 4D-Test 13 passed — Blocker explanation handled with low-friction guidance.`);
}

// [4D-TEST 14] Complete flow: neglected goal detected -> rest response -> approved action
console.log("\n[4D-TEST 14] Complete flow: neglected goal -> rest/overload -> approved adjustment");
{
  // Step 1: Detect neglected goal
  const neglectedGoal = {
    id: "g_capstone",
    title: "Capstone Project",
    priority: "HIGH",
    daysSinceUpdated: 7,
    avoidCount: 1,
    progressPercent: 25,
  };
  const ctx = createBaseContext({
    currentHour: 15,
    neglectedGoals: [neglectedGoal],
    highPriorityNeglectedGoals: [neglectedGoal],
  });

  const decision = decideNikkiNudge(ctx);
  assert.strictEqual(decision.shouldSpeak, true);
  assert.strictEqual(decision.trigger, "goal_neglected");

  // Step 2: Nikki initiates conversation referencing the goal
  const opening = getPersonaFallbackMessage(ctx, decision);
  assert(opening.includes("Capstone Project"));

  // Step 3: User responds with overload ("I have too much college work")
  const restReply = parseAccountabilityIntent("I have too much college work", {
    targetId: neglectedGoal.id,
    targetTitle: neglectedGoal.title,
    targetType: "goal",
    userName: "Nishtha",
  });
  assert.strictEqual(restReply.intent, "rest_and_fatigue");
  assert.strictEqual(restReply.shouldModifyDatabase, false);
  assert.strictEqual(restReply.pendingAction?.action, "adjust_goal");

  // Step 4: User approves the suggested tomorrow adjustment ("Yes, sounds good")
  const confirmReply = parseAccountabilityIntent("Yes, sounds good", {
    targetId: neglectedGoal.id,
    targetTitle: neglectedGoal.title,
    targetType: "goal",
    userName: "Nishtha",
  });
  assert.strictEqual(confirmReply.intent, "confirm_action");
  assert.strictEqual(confirmReply.shouldModifyDatabase, true);
  assert.strictEqual(confirmReply.actionToExecute, "confirm_pending");

  console.log("✓ 4D-Test 14 passed — Complete neglected-goal -> rest -> confirmation flow verified.");
}

console.log("\n==========================================================================");
console.log("ALL PART 4C & PART 4D TESTS PASSED! (15/15)");
console.log("==========================================================================");
