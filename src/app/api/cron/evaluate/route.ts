import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { PushSubscriptionModel } from "@/models/PushSubscription";
import { UserModel } from "@/models/User";
import { evaluateProactiveContext } from "@/services/notificationService";
import { dispatchDueTimetableReminders } from "@/services/timetableReminderService";

export const runtime = "nodejs";

/**
 * Background Cron Job: Proactive Timetable & Health Check-In Evaluator.
 *
 * This endpoint is triggered on a recurring schedule by Vercel Cron or an
 * external scheduler (e.g. GitHub Actions, cron-job.org) to evaluate
 * upcoming timetable events, departures, study blocks, and check-ins for all
 * users with active push subscriptions, even when the Companion PWA is closed.
 *
 * Security:
 * Requires authorization header Bearer <CRON_SECRET> or ?key=<CRON_SECRET>
 * if CRON_SECRET is configured in environment variables.
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

    await connectToDatabase();

    // Find all users who have registered push subscriptions
    const subscribedUids: string[] = await PushSubscriptionModel.distinct("firebaseUid");

    if (!subscribedUids || subscribedUids.length === 0) {
      return NextResponse.json({
        data: {
          evaluatedUsers: 0,
          totalNotificationsGenerated: 0,
          message: "No active push subscriptions found.",
        },
      });
    }

    let totalNotificationsGenerated = 0;
    const results: Array<{ uid: string; count: number }> = [];

    // Evaluate each user sequentially to avoid database overload
    for (const uid of subscribedUids) {
      try {
        const userProfile = await UserModel.findOne({ firebaseUid: uid });
        const userTimezone = userProfile?.timezone || "UTC";

        const { newNotificationsCount } = await evaluateProactiveContext(uid, userTimezone);
        totalNotificationsGenerated += newNotificationsCount;
        results.push({ uid, count: newNotificationsCount });
      } catch (userErr) {
        // Non-fatal per-user error
        console.error(`[Companion Cron] Evaluation failed for user ${uid}:`, userErr);
      }
    }

    // Also dispatch any due timetable reminders and follow-up nudges
    let timetableDispatchResult = null;
    try {
      timetableDispatchResult = await dispatchDueTimetableReminders();
    } catch (dispatchErr) {
      console.error("[Companion Cron] Timetable reminders dispatch error:", dispatchErr);
    }

    return NextResponse.json({
      data: {
        evaluatedUsers: subscribedUids.length,
        totalNotificationsGenerated,
        results,
        timetableDispatch: timetableDispatchResult,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Companion Cron] Background evaluation error:", error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : "Cron evaluation failed",
          code: "CRON_FAILED",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

