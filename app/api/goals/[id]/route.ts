import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { getGoal, updateGoal, deleteGoal } from "@/services/goalService";
import { GoalPersistenceError, GoalCompletedError } from "@/lib/goals/errors";
import { validateUpdateGoalPayload } from "@/lib/validation/goal";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/** Returns one goal — ONLY if it belongs to the authenticated user. Next.js 15: route params are async. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const goal = await getGoal(id, user.uid);
    if (!goal) {
      return NextResponse.json({ error: { message: "Goal not found.", code: "GOAL_NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json({ data: goal });
  } catch (error) {
    return handleGoalError(error, "GET /api/goals/[id]");
  }
}

/** Updates any combination of a goal's fields, including status and progress, in one call — mirrors /api/user/profile's PATCH pattern rather than one endpoint per verb. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, data } = validateUpdateGoalPayload(body);
    if (!valid || !data) {
      return NextResponse.json({ error: { message: errors.join(" "), code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const goal = await updateGoal(id, user.uid, data);
    if (!goal) {
      return NextResponse.json({ error: { message: "Goal not found.", code: "GOAL_NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json({ data: goal });
  } catch (error) {
    return handleGoalError(error, "PATCH /api/goals/[id]");
  }
}

/** Hard-deletes a goal — never allowed once COMPLETED. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const deleted = await deleteGoal(id, user.uid);
    if (deleted === null) {
      return NextResponse.json({ error: { message: "Goal not found.", code: "GOAL_NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleGoalError(error, "DELETE /api/goals/[id]");
  }
}

function handleGoalError(error: unknown, routeLabel: string): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  if (error instanceof GoalCompletedError) {
    return NextResponse.json({ error: { message: error.message, code: "GOAL_COMPLETED" } }, { status: error.status });
  }

  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);

  if (error instanceof GoalPersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't reach that goal just now.", error),
          code: "GOAL_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with that goal.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}