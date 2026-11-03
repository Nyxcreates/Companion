import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { pauseFocusSession, resumeFocusSession, completeFocusSession, cancelFocusSession } from "@/services/focusService";
import { FocusPersistenceError, SessionNotActionableError } from "@/lib/focus/errors";
import { validateSessionActionPayload } from "@/lib/validation/focus";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/**
 * Applies one of "pause" / "resume" / "complete" / "cancel" to a
 * session — a single action-discriminated endpoint rather than four
 * separate routes, since all four are ownership-checked state
 * transitions on the same resource (mirrors how PATCH /api/tasks/[id]
 * bundles multiple field updates into one endpoint).
 *
 * Next.js 15: route params are async — must be awaited.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, action } = validateSessionActionPayload(body);
    if (!valid || !action) {
      return NextResponse.json({ error: { message: errors.join(" "), code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const session =
      action === "pause"
        ? await pauseFocusSession(id, user.uid)
        : action === "resume"
          ? await resumeFocusSession(id, user.uid)
          : action === "complete"
            ? await completeFocusSession(id, user.uid)
            : await cancelFocusSession(id, user.uid);

    if (!session) {
      return NextResponse.json(
        { error: { message: "Focus session not found.", code: "FOCUS_SESSION_NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: session });
  } catch (error) {
    return handleFocusError(error);
  }
}

function handleFocusError(error: unknown): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }
  if (error instanceof SessionNotActionableError) {
    return NextResponse.json(
      { error: { message: error.message, code: "SESSION_NOT_ACTIONABLE" } },
      { status: error.status }
    );
  }

  // eslint-disable-next-line no-console
  console.error("[Companion] PATCH /api/focus/[id] failed:", error);

  if (error instanceof FocusPersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't update that focus session just now.", error),
          code: "FOCUS_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with that session.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}