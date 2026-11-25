import type { TaskSummary } from "@/types/task";
import type { GoalSummary } from "@/types/goal";

export type AccountabilityIntentType =
  | "rest_and_fatigue"
  | "break_task"
  | "start_task"
  | "reschedule_task"
  | "change_priority"
  | "adjust_goal"
  | "complete_item"
  | "explain_blocker"
  | "confirm_action"
  | "general";

export interface AccountabilityAnalysis {
  intent: AccountabilityIntentType;
  targetId?: string | null;
  targetType?: "task" | "goal" | null;
  targetTitle?: string | null;
  proposedSteps?: string[];
  newDueDate?: string | null;
  newPriority?: "LOW" | "MEDIUM" | "HIGH" | "low" | "medium" | "high" | null;
  replyMessage?: string;
  pose: "happy" | "celebrate" | "concerned" | "think" | "sleepy" | "curious" | "wave";
  shouldModifyDatabase: boolean;
  actionToExecute?: string;
}

/**
 * Parses user responses to proactive goal/task nudges and identifies accountability intent.
 */
export function parseAccountabilityIntent(
  message: string,
  meta?: {
    targetId?: string | null;
    targetTitle?: string | null;
    targetType?: "task" | "goal" | null;
    userName?: string;
    strictness?: string;
  }
): AccountabilityAnalysis {
  const text = message.trim();
  const lower = text.toLowerCase();
  const title = meta?.targetTitle || "this task";
  const userName = meta?.userName || "friend";

  // 1. Rest / Fatigue / Overload ("I'm tired", "too much college work", "exhausted", "burnout")
  // Requirement: Never treat rest as failure.
  if (
    /\b(tired|exhausted|burnout|burned out|overwhelmed|too much (work|college|school|studying)|need (a )?break|need (to )?rest|can't do this today|not feeling well|drained|no energy)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "rest_and_fatigue",
      targetId: meta?.targetId,
      targetType: meta?.targetType,
      targetTitle: meta?.targetTitle,
      replyMessage: `Okay, fair. Let's not overload you, ${userName}. Rest is completely valid, not a failure. We can give '${title}' 30 minutes tomorrow instead or let it breathe for now. Go take a breath and recharge today! 🌸`,
      pose: "sleepy",
      shouldModifyDatabase: false,
    };
  }

  // 2. Completed / Finished ("I actually completed it!", "mark complete", "finished it")
  if (
    /\b(finished|completed|done with it|mark (it )?(as )?complete|checked off|i did it|all done|cross(ed)? (it )?off|already done|actually completed)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "complete_item",
      targetId: meta?.targetId,
      targetType: meta?.targetType || "task",
      targetTitle: meta?.targetTitle,
      replyMessage: `WAITTT! You actually completed it?! I'm proud of you, ${userName}! 🎉 Crossing '${title}' off your list right now — that's genuine momentum!`,
      pose: "celebrate",
      shouldModifyDatabase: Boolean(meta?.targetId),
      actionToExecute: meta?.targetType === "goal" ? "complete_goal" : "complete_task",
    };
  }

  // 3. Break into smaller steps ("break it down", "smaller steps", "split it up", "micro steps")
  if (
    /\b(break (it )?(down|into)|smaller steps|split (it )?up|micro steps|subtasks|chunk it|too big)\b/i.test(
      lower
    )
  ) {
    const steps = generateDefaultSubSteps(title);
    const stepsText = steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n");

    return {
      intent: "break_task",
      targetId: meta?.targetId,
      targetType: "task",
      targetTitle: meta?.targetTitle,
      proposedSteps: steps,
      replyMessage: `Let's make this way easier to start, ${userName}! How about we break '${title}' into these smaller pieces:\n\n${stepsText}\n\nWant me to add these steps to your tasks? Just say 'yes'!`,
      pose: "think",
      shouldModifyDatabase: false, // Requires user confirmation
    };
  }

  // 4. Adjust Goal ("extend deadline", "adjust goal", "change goal target")
  if (/\b(adjust (the )?goal|change (the )?deadline|extend (the )?deadline|new deadline|goal target)\b/i.test(lower)) {
    const targetDate = resolveRelativeDueDate(lower);
    const formattedDate = targetDate.toISOString().slice(0, 10);

    return {
      intent: "adjust_goal",
      targetId: meta?.targetId,
      targetType: "goal",
      targetTitle: meta?.targetTitle,
      newDueDate: formattedDate,
      replyMessage: `All set, ${userName}! I've adjusted the deadline for your goal '${title}'. Setting realistic timelines is smart, not a compromise.`,
      pose: "happy",
      shouldModifyDatabase: Boolean(meta?.targetId),
      actionToExecute: "adjust_goal",
    };
  }

  // 5. Reschedule / Postpone ("reschedule to tomorrow", "move to tomorrow", "postpone to Friday")
  if (
    /\b(reschedule|postpone|move (it )?to|push (it )?to|delay|shift (it )?to|tomorrow|next week|later today)\b/i.test(
      lower
    )
  ) {
    const targetDate = resolveRelativeDueDate(lower);
    const formattedDate = targetDate.toISOString().slice(0, 10);

    return {
      intent: "reschedule_task",
      targetId: meta?.targetId,
      targetType: "task",
      targetTitle: meta?.targetTitle,
      newDueDate: formattedDate,
      replyMessage: `Got it, ${userName}! I've moved '${title}' to ${lower.includes("tomorrow") ? "tomorrow" : formattedDate}. One less thing to stress about today — take a deep breath!`,
      pose: "curious",
      shouldModifyDatabase: Boolean(meta?.targetId),
      actionToExecute: "reschedule_task",
    };
  }

  // 6. Change Priority ("make it low priority", "change priority to high", "bump priority")
  if (/\b(priority|make (it )?(low|medium|high)|change (the )?priority|bump (it )?to)\b/i.test(lower)) {
    let newPriority: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
    if (lower.includes("high")) newPriority = "HIGH";
    else if (lower.includes("low")) newPriority = "LOW";

    return {
      intent: "change_priority",
      targetId: meta?.targetId,
      targetType: meta?.targetType || "task",
      targetTitle: meta?.targetTitle,
      newPriority,
      replyMessage: `Done! I've updated '${title}' to ${newPriority} priority. Let's focus on what truly matters most.`,
      pose: "happy",
      shouldModifyDatabase: Boolean(meta?.targetId),
      actionToExecute: "change_priority",
    };
  }

  // 7. Start Working on It ("start now", "working on it", "dive in", "let's do it")
  if (/\b(start(ing)? (now|it)|working on it|dive in|on it|let's do it|doing it now)\b/i.test(lower)) {
    return {
      intent: "start_task",
      targetId: meta?.targetId,
      targetType: meta?.targetType,
      targetTitle: meta?.targetTitle,
      replyMessage: `Awesome! You've got this, ${userName}! Let's lock in just 15 or 25 minutes on '${title}' — starting is the hardest part, and you're already doing it! 💪`,
      pose: "celebrate",
      shouldModifyDatabase: false,
    };
  }

  // 8. Explain Blocker ("stuck on", "blocked by", "hard because", "friction", "don't know where to start")
  if (/\b(stuck (on|with)|blocked (by|on)|hard because|friction|don't know where to start|confused about|feeling resistance)\b/i.test(lower)) {
    return {
      intent: "explain_blocker",
      targetId: meta?.targetId,
      targetType: meta?.targetType,
      targetTitle: meta?.targetTitle,
      replyMessage: `I hear you, ${userName}. That makes total sense — when a task feels stuck, it's usually because the very first step isn't small enough. What's the absolute tiniest 2-minute action we could take on '${title}'?`,
      pose: "think",
      shouldModifyDatabase: false,
    };
  }

  // 9. Confirm action ("yes", "do it", "confirm", "add them", "sounds good", "go ahead")
  if (/^(yes|yeah|sure|do it|confirm|please do|add them|sounds good|go ahead|yep|ok|okay)\b/i.test(lower)) {
    return {
      intent: "confirm_action",
      targetId: meta?.targetId,
      targetType: meta?.targetType,
      targetTitle: meta?.targetTitle,
      replyMessage: `You got it, ${userName}! Executing that right now for '${title}'. Let's keep this feeling light and doable! ✨`,
      pose: "celebrate",
      shouldModifyDatabase: true,
      actionToExecute: "confirm_pending",
    };
  }

  return {
    intent: "general",
    targetId: meta?.targetId,
    targetType: meta?.targetType,
    targetTitle: meta?.targetTitle,
    pose: "happy",
    shouldModifyDatabase: false,
  };
}

/**
 * Executes an accountability action safely through existing database services.
 * Reuses existing models and APIs, preserving task and goal history without duplicate storage.
 */
export async function executeAccountabilityAction(params: {
  action: string;
  firebaseUid: string;
  targetId: string;
  targetType?: "task" | "goal";
  payload?: Record<string, unknown>;
}) {
  const { action, firebaseUid, targetId, payload = {} } = params;
  const { updateTask, createTask, getTask } = await import("@/services/taskService");
  const { updateGoal } = await import("@/services/goalService");

  if (action === "complete_task") {
    const updated = await updateTask(targetId, firebaseUid, { status: "COMPLETED" });
    return { ok: true, action, task: updated };
  }

  if (action === "complete_goal") {
    const updated = await updateGoal(targetId, firebaseUid, { status: "COMPLETED" });
    return { ok: true, action, goal: updated };
  }

  if (action === "reschedule_task") {
    const dueDate = typeof payload.dueDate === "string" ? payload.dueDate : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const updated = await updateTask(targetId, firebaseUid, { dueDate });
    return { ok: true, action, task: updated };
  }

  if (action === "change_priority") {
    const priority = typeof payload.priority === "string" ? (payload.priority.toUpperCase() as "LOW" | "MEDIUM" | "HIGH") : "MEDIUM";
    if (params.targetType === "goal") {
      const updated = await updateGoal(targetId, firebaseUid, { priority });
      return { ok: true, action, goal: updated };
    }
    const updated = await updateTask(targetId, firebaseUid, {});
    return { ok: true, action, task: updated, newPriority: priority };
  }

  if (action === "adjust_goal") {
    const newDeadline = typeof payload.newDeadline === "string" ? payload.newDeadline : null;
    const targetValue = typeof payload.targetValue === "number" ? payload.targetValue : undefined;
    const updated = await updateGoal(targetId, firebaseUid, {
      deadline: newDeadline,
      targetValue,
    });
    return { ok: true, action, goal: updated };
  }

  if (action === "break_task") {
    const steps: string[] = Array.isArray(payload.steps)
      ? payload.steps.filter((s: unknown) => typeof s === "string" && s.trim().length > 0).slice(0, 5)
      : generateDefaultSubSteps(String(payload.title || "Task"));

    const parentTask = await getTask(targetId, firebaseUid);
    if (!parentTask) {
      return { ok: false, error: "Parent task not found" };
    }

    const createdTasks = [];
    for (const stepTitle of steps) {
      const subTask = await createTask({
        firebaseUid,
        title: stepTitle.trim(),
        description: `Sub-task of: ${parentTask.title}`,
        dueDate: parentTask.dueDate ?? null,
        goalId: parentTask.goalId ?? null,
      });
      createdTasks.push(subTask);
    }

    return { ok: true, action, createdTasks, parentTaskId: targetId };
  }

  return { ok: true, action };
}

/** Helper: Generates sensible 2-3 mini steps for breaking down a task */
export function generateDefaultSubSteps(taskTitle: string): string[] {
  const cleanTitle = taskTitle.replace(/^['"]|['"]$/g, "").trim();
  return [
    `Quick 5-minute setup & outline for ${cleanTitle}`,
    `Focus block: Complete first section of ${cleanTitle} (15m)`,
    `Review and wrap up ${cleanTitle} (10m)`,
  ];
}

/** Helper: Resolves relative date expressions like "tomorrow", "next week" */
function resolveRelativeDueDate(text: string): Date {
  const now = new Date();
  if (text.includes("tomorrow")) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  if (text.includes("next week") || text.includes("in a week")) {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  if (text.includes("friday")) {
    const day = now.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    return new Date(now.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000);
  }
  if (text.includes("monday")) {
    const day = now.getDay();
    const daysUntilMonday = (1 - day + 7) % 7 || 7;
    return new Date(now.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
  }
  // Default to tomorrow
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
