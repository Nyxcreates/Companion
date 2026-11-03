import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { getActiveFocusSession } from "@/services/focusService";
import { FocusPersistenceError } from "@/lib/focus/errors";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/** Returns the authenticated user's current ACTIVE/PAUSED session, or null — used to recover state after a refresh or reopened tab (spec section 18). The client re-derives its own ticking display from the returned timestamps; this endpoint is never polled on an interval. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const session = await getActiveFocusSession(user.uid);
    return NextResponse.json({ data: session });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }

    // eslint-disable-next-line no-console
    console.error("[Companion] GET /api/focus/active failed:", error);

    if (error instanceof FocusPersistenceError) {
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Couldn't check for an active session just now.", error),
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
}