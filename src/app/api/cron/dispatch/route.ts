import { NextRequest, NextResponse } from "next/server";
import { dispatchDueTimetableReminders } from "@/services/timetableReminderService";
import { dispatchDueBreaks } from "@/services/breakSessionService";

export const runtime = "nodejs";

/**
 * Background Cron Job: Timetable Push Dispatcher.
 *
 * Finds due timetable reminders and 15-minute follow-up nudges,
 * and sends web push notifications even when the app is closed.
 *
 * Protected by CRON_SECRET via:
 *   - Header: Authorization: Bearer <CRON_SECRET>
 *   - Query: ?key=<CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const urlKey = request.nextUrl.searchParams.get("key");
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || urlKey === cronSecret;

      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const [timetableResult, breakResult] = await Promise.all([
      dispatchDueTimetableReminders(),
      dispatchDueBreaks(),
    ]);

    return NextResponse.json({
      data: {
        ...timetableResult,
        breaks: breakResult,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Companion Cron Dispatch] Dispatch error:", error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : "Timetable reminder dispatch failed",
          code: "DISPATCH_FAILED",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

