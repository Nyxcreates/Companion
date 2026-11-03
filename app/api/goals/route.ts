import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { createGoal, listGoals } from "@/services/goalService";
import { GoalPersistenceError } from "@/lib/goals/errors";
import { validateCreateGoalPayload } from "@/lib/validation/goal";
import { withDevDetail } from "@/lib/api/errorResponse";
import { GOAL_STATUSES } from "@/lib/goals/constants";
import type { GoalStatus } from "@/types/goal";

export const runtime = "nodejs";

/** Returns the authenticated user's own goals, optionally filtered by status (?status=ACTIVE). Never accepts a userId from the client. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    let statusFilter: GoalStatus | undefined;
    if (statusParam !== null) {
      if (!GOAL_STATUSES.includes(statusParam as GoalStatus)) {
        return NextResponse.json(
          { error: { message: "Invalid status filter.", code: "VALIDATION_ERROR" } },
          { status: 400 }
        );
      }
      statusFilter = statusParam as GoalStatus;
    }

    const goals = await listGoals(user.uid, statusFilter);
    return NextResponse.json({ data: goals });
  } catch (error) {
    return handleGoalsError(error, "GET /api/goals");
  }
}

/** Creates a new goal for the authenticated user, always starting ACTIVE. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, data } = validateCreateGoalPayload(body);
    if (!valid || !data) {
      return NextResponse.json({ error: { message: errors.join(" "), code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const goal = await createGoal({
      firebaseUid: user.uid,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      deadline: data.deadline,
      targetLabel: data.targetLabel,
      targetValue: data.targetValue,
    });

    return NextResponse.json({ data: goal }, { status: 201 });
  } catch (error) {
    return handleGoalsError(error, "POST /api/goals");
  }
}

function handleGoalsError(error: unknown, routeLabel: string): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);

  if (error instanceof GoalPersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't reach your goals just now.", error),
          code: "GOAL_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with your goals.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}