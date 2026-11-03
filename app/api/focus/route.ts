import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { startFocusSession, listFocusSessions } from "@/services/focusService";
import { FocusPersistenceError, InvalidTaskReferenceError, SessionAlreadyActiveError } from "@/lib/focus/errors";
import { validateStartSessionPayload } from "@/lib/validation/focus";
import { withDevDetail } from "@/lib/api/errorResponse";
import type { FocusSessionStatus } from "@/types/focus";

export const runtime = "nodejs";

const VALID_STATUSES: FocusSessionStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];

/** Returns the authenticated user's own focus session history, optionally filtered by ?status= and/or ?taskId=. Never accepts a userId from the client. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    let statusFilter: FocusSessionStatus | undefined;
    if (statusParam !== null) {
      if (!VALID_STATUSES.includes(statusParam as FocusSessionStatus)) {
        return NextResponse.json(
          { error: { message: "Invalid status filter.", code: "VALIDATION_ERROR" } },
          { status: 400 }
        );
      }
      statusFilter = statusParam as FocusSessionStatus;
    }
    const taskIdParam = searchParams.get("taskId") ?? undefined;

    const sessions = await listFocusSessions(user.uid, { status: statusFilter, taskId: taskIdParam });
    return NextResponse.json({ data: sessions });
  } catch (error) {
    return handleFocusError(error, "GET /api/focus");
  }
}

/** Starts a new focus session for the authenticated user. Rejects if a session is already ACTIVE/PAUSED, or if taskId doesn't resolve to a Task owned by this user. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, data } = validateStartSessionPayload(body);
    if (!valid || !data) {
      return NextResponse.json({ error: { message: errors.join(" "), code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const session = await startFocusSession({ firebaseUid: user.uid, ...data });
    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    return handleFocusError(error, "POST /api/focus");
  }
}

function handleFocusError(error: unknown, routeLabel: string): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }
  if (error instanceof InvalidTaskReferenceError) {
    return NextResponse.json(
      { error: { message: error.message, code: "INVALID_TASK_REFERENCE" } },
      { status: error.status }
    );
  }
  if (error instanceof SessionAlreadyActiveError) {
    return NextResponse.json(
      { error: { message: error.message, code: "SESSION_ALREADY_ACTIVE" } },
      { status: error.status }
    );
  }

  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);

  if (error instanceof FocusPersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't reach your focus sessions just now.", error),
          code: "FOCUS_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with focus mode.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}