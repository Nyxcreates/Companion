import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { getTask, updateTask, createTask } from "@/services/taskService";
import { getGoal, updateGoal } from "@/services/goalService";

export const runtime = "nodejs";

type AccountabilityAction = "break_task" | "reschedule_task" | "adjust_goal" | "focus_now" | "ask_blocker";

/**
 * POST /api/nikki/accountability
 *
 * Executes a goal/task accountability action Nikki proposes in conversation:
 *   - break_task:     Creates up to 5 sub-tasks linked to the parent task's goal
 *   - reschedule_task: Updates the task's dueDate
 *   - adjust_goal:    Updates the goal's deadline
 *   - focus_now:      No-op (handled client-side — opens focus mode)
 *   - ask_blocker:    No-op (handled client-side — opens chat)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action as AccountabilityAction : null;
    const targetId = typeof body.targetId === "string" ? body.targetId.trim() : null;
    const targetType = typeof body.targetType === "string" ? body.targetType : null;
    const payload = body.payload || {};

    if (!action || !["break_task", "reschedule_task", "adjust_goal", "focus_now", "ask_blocker"].includes(action)) {
      return NextResponse.json({ error: { message: "Invalid action.", code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    if (!targetId) {
      return NextResponse.json({ error: { message: "targetId is required.", code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    // No-op client-handled actions
    if (action === "focus_now" || action === "ask_blocker") {
      return NextResponse.json({ data: { ok: true, action } });
    }

    if (action === "reschedule_task") {
      if (!payload.dueDate || typeof payload.dueDate !== "string") {
        return NextResponse.json({ error: { message: "payload.dueDate is required for reschedule_task.", code: "VALIDATION_ERROR" } }, { status: 400 });
      }
      const updated = await updateTask(targetId, user.uid, { dueDate: payload.dueDate });
      if (!updated) {
        return NextResponse.json({ error: { message: "Task not found.", code: "TASK_NOT_FOUND" } }, { status: 404 });
      }
      return NextResponse.json({ data: { ok: true, action, task: updated } });
    }

    if (action === "adjust_goal") {
      if (!payload.newDeadline || typeof payload.newDeadline !== "string") {
        return NextResponse.json({ error: { message: "payload.newDeadline is required for adjust_goal.", code: "VALIDATION_ERROR" } }, { status: 400 });
      }
      const updated = await updateGoal(targetId, user.uid, { deadline: payload.newDeadline });
      if (!updated) {
        return NextResponse.json({ error: { message: "Goal not found.", code: "GOAL_NOT_FOUND" } }, { status: 404 });
      }
      return NextResponse.json({ data: { ok: true, action, goal: updated } });
    }

    if (action === "break_task") {
      const steps: string[] = Array.isArray(payload.steps)
        ? payload.steps.filter((s: unknown) => typeof s === "string" && s.trim().length > 0).slice(0, 5)
        : [];

      if (steps.length === 0) {
        return NextResponse.json({ error: { message: "payload.steps must be a non-empty array of strings (max 5).", code: "VALIDATION_ERROR" } }, { status: 400 });
      }

      // Fetch parent task to inherit its goalId
      const parentTask = await getTask(targetId, user.uid);
      if (!parentTask) {
        return NextResponse.json({ error: { message: "Task not found.", code: "TASK_NOT_FOUND" } }, { status: 404 });
      }

      const createdTasks = [];
      for (const stepTitle of steps) {
        const subTask = await createTask({
          firebaseUid: user.uid,
          title: stepTitle.trim(),
          description: `Sub-task of: ${parentTask.title}`,
          dueDate: parentTask.dueDate ?? null,
          goalId: parentTask.goalId ?? null,
        });
        createdTasks.push(subTask);
      }

      return NextResponse.json({ data: { ok: true, action, createdTasks, parentTaskId: targetId } });
    }

    return NextResponse.json({ error: { message: "Unhandled action.", code: "INTERNAL_ERROR" } }, { status: 500 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Accountability] POST error:", error);
    return NextResponse.json({ error: { message: "Failed to execute accountability action.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
