import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { getSchedule, deleteSchedule } from "@/services/scheduleService";
import { SchedulePersistenceError } from "@/lib/schedule/errors";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the authenticated user's own schedule for one date, or null if nothing's been generated yet. Next.js 15: route params are async. */
export async function GET(request: NextRequest, context: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await context.params;
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: { message: "Invalid date.", code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const user = await requireAuthenticatedUser(request);
    const schedule = await getSchedule(user.uid, date);
    return NextResponse.json({ data: schedule });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }

    // eslint-disable-next-line no-console
    console.error("[Companion] GET /api/schedule/[date] failed:", error);

    if (error instanceof SchedulePersistenceError) {
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Couldn't load that schedule just now.", error),
            code: "SCHEDULE_PERSISTENCE_FAILED",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: { message: withDevDetail("Something went wrong loading that schedule.", error), code: "UNKNOWN_ERROR" } },
      { status: 500 }
    );
  }
}
/** Deletes the authenticated user's schedule for one date. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await context.params;
    if (!DATE_RE.test(date)) {
      return NextResponse.json({ error: { message: "Invalid date.", code: "VALIDATION_ERROR" } }, { status: 400 });
    }
    const user = await requireAuthenticatedUser(request);
    const deleted = await deleteSchedule(user.uid, date);
    if (deleted === null) {
      return NextResponse.json({ error: { message: "Schedule not found.", code: "SCHEDULE_NOT_FOUND" } }, { status: 404 });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    // eslint-disable-next-line no-console
    console.error("[Companion] DELETE /api/schedule/[date] failed:", error);
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't delete that schedule just now.", error),
          code: error instanceof SchedulePersistenceError ? "SCHEDULE_PERSISTENCE_FAILED" : "UNKNOWN_ERROR",
        },
      },
      { status: 500 }
    );
  }
}