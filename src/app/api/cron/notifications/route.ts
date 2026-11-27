import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/api/verifyCronAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { PushSubscriptionModel } from "@/models/PushSubscription";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";
import { UserModel } from "@/models/User";
import { evaluateProactiveContext } from "@/services/notificationService";
import { dispatchDueTimetableReminders } from "@/services/timetableReminderService";
import { dispatchDueBreaks } from "@/services/breakSessionService";
import { buildNikkiContext } from "@/lib/nikki/context";
import { decideNikkiNudge } from "@/lib/nikki/decide";
import { speakNikkiNudge } from "@/lib/nikki/speak";
import { resolveUserTimezone } from "@/lib/time/currentTime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dedicated external-scheduler endpoint (e.g. cron-job.org) for Companion
 * background notifications.
 *
 * - Accepts authenticated POST requests only (`Authorization: Bearer <CRON_SECRET>`).
 * - Checks user preferences, timezones, quiet hours, and due schedules.
 * - Safe to call repeatedly or concurrently; persistent MongoDB idempotency
 *   prevents duplicate deliveries even after timeouts or retries.
 * - Returns compact aggregate counts with zero private user data.
 * - Also supports GET for quick health checks (same auth required).
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  try {
    await connectToDatabase();
    const now = new Date();

    const [timetableResult, breakResult, subscribedUids] = await Promise.all([
      dispatchDueTimetableReminders(),
      dispatchDueBreaks(),
      PushSubscriptionModel.distinct("firebaseUid") as Promise<string[]>,
    ]);

    let evaluatedUsers = 0;
    let notificationsGenerated = 0;
    let nikkiNudgesSent = 0;
    let pausedUsers = 0;
    let autoResumedUsers = 0;

    for (const uid of subscribedUids) {
      try {
        const [prefs, userProfile] = await Promise.all([
          NotificationPreferenceModel.findOne({ firebaseUid: uid }),
          UserModel.findOne({ firebaseUid: uid }),
        ]);

        if (prefs?.proactiveEnabled === false) {
          continue;
        }

        // Auto-clear expired pausedUntil from MongoDB to keep the DB clean
        if (prefs?.pausedUntil) {
          const pausedUntilDate = new Date(prefs.pausedUntil);
          if (pausedUntilDate > now) {
            // Still paused — log remaining time for diagnostics (no PII)
            const minutesRemaining = Math.ceil((pausedUntilDate.getTime() - now.getTime()) / 60000);
            console.log(
              `[Companion Cron] User paused — skipping. Resumes in ~${minutesRemaining} min.`
            );
            pausedUsers++;
            continue;
          } else {
            // Pause has expired — clear it from DB so future reads are clean
            prefs.pausedUntil = null;
            await prefs.save().catch((e: unknown) =>
              console.warn("[Companion Cron] Failed to clear expired pausedUntil:", e)
            );
            autoResumedUsers++;
            console.log("[Companion Cron] Auto-resumed user (expired pause cleared).");
          }
        }

        evaluatedUsers++;
        const userTimezone = resolveUserTimezone(null, userProfile?.timezone);

        const { newNotificationsCount } = await evaluateProactiveContext(
          uid,
          userTimezone
        );
        notificationsGenerated += newNotificationsCount;

        try {
          const context = await buildNikkiContext(uid);
          const decision = decideNikkiNudge(context);
          if (decision.shouldSpeak) {
            const nudge = await speakNikkiNudge(context, decision);
            if (nudge) {
              nikkiNudgesSent++;
            }
          }
        } catch (nikkiErr) {
          console.error(
            "[Companion Cron Notifications] Nikki evaluation error:",
            nikkiErr instanceof Error ? nikkiErr.message : "Unknown error"
          );
        }
      } catch (userErr) {
        console.error(
          "[Companion Cron Notifications] Per-user evaluation error:",
          userErr instanceof Error ? userErr.message : "Unknown error"
        );
      }
    }

    console.log(
      `[Companion Cron] Run complete — evaluated:${evaluatedUsers} paused:${pausedUsers} autoResumed:${autoResumedUsers} nudgesSent:${nikkiNudgesSent}`
    );

    return NextResponse.json({
      data: {
        ok: true,
        evaluatedUsers,
        pausedUsers,
        autoResumedUsers,
        notificationsGenerated,
        nikkiNudgesSent,
        timetableRemindersSent: timetableResult.initialRemindersSent,
        timetableNudgesSent: timetableResult.nudgesSent,
        breakEndNotificationsSent: breakResult.endNotificationsSent,
        breakExtensionNotificationsSent: breakResult.extensionEndNotificationsSent,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "[Companion Cron Notifications] Execution error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      {
        error: {
          message: "Notification cron execution failed",
          code: "CRON_FAILED",
        },
      },
      { status: 500 }
    );
  }
}
