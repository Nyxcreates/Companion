import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { getTask, updateTask, deleteTask } from "@/services/taskService";
import { TaskPersistenceError, InvalidGoalReferenceError } from "@/lib/tasks/errors";
import { validateUpdateTaskPayload } from "@/lib/validation/task";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/** Returns one task — ONLY if it belongs to the authenticated user. Next.js 15: route params are async. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const task = await getTask(id, user.uid);
    if (!task) {
      return NextResponse.json({ error: { message: "Task not found.", code: "TASK_NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json({ data: task });
  } catch (error) {
    return handleTaskError(error, "GET /api/tasks/[id]");
  }
}

/** Updates any combination of a task's fields, including status and goalId, in one call — mirrors PATCH /api/goals/[id]'s pattern rather than one endpoint per verb. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, data } = validateUpdateTaskPayload(body);
    if (!valid || !data) {
      return NextResponse.json({ error: { message: errors.join(" "), code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const task = await updateTask(id, user.uid, data);
    if (!task) {
      return NextResponse.json({ error: { message: "Task not found.", code: "TASK_NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json({ data: task });
  } catch (error) {
    return handleTaskError(error, "PATCH /api/tasks/[id]");
  }
}

/** Hard-deletes a task, regardless of status — see taskService.deleteTask's doc comment for why this differs from Goal's delete-protection rule. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const deleted = await deleteTask(id, user.uid);
    if (deleted === null) {
      return NextResponse.json({ error: { message: "Task not found.", code: "TASK_NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleTaskError(error, "DELETE /api/tasks/[id]");
  }
}

function handleTaskError(error: unknown, routeLabel: string): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  if (error instanceof InvalidGoalReferenceError) {
    return NextResponse.json(
      { error: { message: error.message, code: "INVALID_GOAL_REFERENCE" } },
      { status: error.status }
    );
  }

  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);

  if (error instanceof TaskPersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't reach that task just now.", error),
          code: "TASK_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with that task.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}