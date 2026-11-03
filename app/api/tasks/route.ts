import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { createTask, listTasks } from "@/services/taskService";
import { TaskPersistenceError, InvalidGoalReferenceError } from "@/lib/tasks/errors";
import { validateCreateTaskPayload } from "@/lib/validation/task";
import { withDevDetail } from "@/lib/api/errorResponse";
import { TASK_STATUSES } from "@/lib/tasks/constants";
import type { TaskStatus } from "@/types/task";

export const runtime = "nodejs";

/** Returns the authenticated user's own tasks, optionally filtered by ?status= and/or ?goalId=. Never accepts a userId from the client. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    let statusFilter: TaskStatus | undefined;
    if (statusParam !== null) {
      if (!TASK_STATUSES.includes(statusParam as TaskStatus)) {
        return NextResponse.json(
          { error: { message: "Invalid status filter.", code: "VALIDATION_ERROR" } },
          { status: 400 }
        );
      }
      statusFilter = statusParam as TaskStatus;
    }
    const goalIdParam = searchParams.get("goalId") ?? undefined;

    const tasks = await listTasks(user.uid, { status: statusFilter, goalId: goalIdParam });
    return NextResponse.json({ data: tasks });
  } catch (error) {
    return handleTasksError(error, "GET /api/tasks");
  }
}

/** Creates a new task for the authenticated user, always starting PENDING. If goalId is given, it must reference a Goal owned by this user. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, data } = validateCreateTaskPayload(body);
    if (!valid || !data) {
      return NextResponse.json({ error: { message: errors.join(" "), code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const task = await createTask({ firebaseUid: user.uid, ...data });
    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    return handleTasksError(error, "POST /api/tasks");
  }
}

function handleTasksError(error: unknown, routeLabel: string): Response {
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
          message: withDevDetail("Couldn't reach your tasks just now.", error),
          code: "TASK_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with your tasks.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}