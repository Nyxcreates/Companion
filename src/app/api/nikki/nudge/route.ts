import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { NikkiNudgeModel, type NikkiNudgeDocument } from "@/models/NikkiNudge";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";
import { buildNikkiContext } from "@/lib/nikki/context";
import { decideNikkiNudge } from "@/lib/nikki/decide";
import { speakNikkiNudge } from "@/lib/nikki/speak";
import { signNudgeActionToken } from "@/lib/nikki/actionToken";
import {
  buildLongLaptopSessionIdempotencyKey,
  hasMinGapElapsed,
  MIN_GAP_BETWEEN_UNPROMPTED_MS,
} from "@/lib/nikki/reminderPolicy";

export const runtime = "nodejs";

function derivePose(trigger: string, meta: Record<string, unknown>): string {
  if (trigger === "focus_finished" || trigger === "task_celebration" || trigger === "hobby_reminder") {
    return "happy";
  }
  if (trigger === "late_night" || trigger === "unusually_late" || trigger === "sleep_reminder") {
    return "sleepy";
  }
  if (trigger === "task_overdue" || trigger === "activity_missed" || meta.isCaringFrustration) {
    return "concerned";
  }
  if (trigger === "goal_neglected" && meta.isCaringFrustration) {
    return "think";
  }
  if (
    trigger === "no_timetable" ||
    trigger === "deadline_approaching" ||
    trigger === "task_unfinished" ||
    trigger === "study_reminder" ||
    trigger === "upcoming_activity"
  ) {
    return "curious";
  }
  if (trigger === "user_returned" || trigger === "general_checkin" || trigger === "app_opened") {
    return "wave";
  }
  return "happy";
}

function serializeNudge(nudge: NikkiNudgeDocument, snoozeMinutes: number) {
  const meta = (nudge.metadata || {}) as Record<string, unknown>;
  const nudgeId = String(nudge._id);
  const doneToken = signNudgeActionToken({
    uid: nudge.firebaseUid,
    nudgeId,
    trigger: nudge.trigger,
    action: "done",
  });
  const snoozeToken = signNudgeActionToken({
    uid: nudge.firebaseUid,
    nudgeId,
    trigger: nudge.trigger,
    action: "snooze",
    minutes: 15,
  });
  return {
    id: nudgeId,
    trigger: nudge.trigger,
    message: nudge.message,
    status: nudge.status,
    idempotencyKey: nudge.idempotencyKey,
    strictness: nudge.strictness,
    pose: derivePose(nudge.trigger, meta),
    metadata: {
      ...meta,
      sleepReminderSnoozeMinutes: snoozeMinutes,
      doneToken,
      snoozeToken,
    },
    createdAt: nudge.createdAt.toISOString(),
  };
}

/**
 * GET /api/nikki/nudge
 *
 * Fetches the latest pending/undismissed NikkiNudge for the current user,
 * wakes any due snoozed nudges, and optionally evaluates proactive rules
 * when `?evaluate=1` is passed (used by the standalone desktop companion).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    await connectToDatabase();

    const now = new Date();
    const prefs = await NotificationPreferenceModel.findOne({ firebaseUid: user.uid })
      .select("sleepReminderSnoozeMinutes pausedUntil proactiveEnabled")
      .lean();
    const snoozeMinutes = prefs?.sleepReminderSnoozeMinutes ?? 25;

    // Respect pause preference
    if (prefs?.pausedUntil && new Date(prefs.pausedUntil) > now) {
      return NextResponse.json({ data: null });
    }

    // Check minimum 10-minute gap since last delivered/created unprompted nudge
    const lastDelivered = await NikkiNudgeModel.findOne({
      firebaseUid: user.uid,
      status: { $in: ["delivered", "replied", "done"] },
    })
      .sort({ deliveredAt: -1, createdAt: -1 })
      .select("deliveredAt createdAt")
      .lean();
    const lastDeliveredMs = lastDelivered
      ? new Date(lastDelivered.deliveredAt || lastDelivered.createdAt).getTime()
      : null;

    // 1. Atomically wake up any snoozed nudge whose snoozedUntil has arrived
    //    (Note: snooze intervals are >= 5-15m, and we still enforce the 10-min gap)
    if (hasMinGapElapsed(lastDeliveredMs, now.getTime(), MIN_GAP_BETWEEN_UNPROMPTED_MS)) {
      const dueSnoozed = await NikkiNudgeModel.findOneAndUpdate(
        {
          firebaseUid: user.uid,
          status: "snoozed",
          snoozedUntil: { $lte: now },
        },
        {
          $set: { status: "delivered", snoozedUntil: null, deliveredAt: now },
        },
        { sort: { snoozedUntil: 1 }, new: true }
      );

      if (dueSnoozed) {
        return NextResponse.json({ data: serializeNudge(dueSnoozed, snoozeMinutes) });
      }
    }

    // 2. Atomically claim an undelivered ("created") nudge — never re-deliver already "delivered" nudges
    const nudge = await NikkiNudgeModel.findOneAndUpdate(
      {
        firebaseUid: user.uid,
        status: "created",
      },
      {
        $set: { status: "delivered", deliveredAt: now },
      },
      { sort: { createdAt: -1 }, new: true }
    );

    if (nudge) {
      return NextResponse.json({ data: serializeNudge(nudge, snoozeMinutes) });
    }

    // 3. Optionally evaluate proactive rules (e.g. sleep snooze repeat or scheduled check-in)
    const shouldEvaluate = request.nextUrl.searchParams.get("evaluate") === "1";
    const clientTimezone = request.nextUrl.searchParams.get("timezone");
    if (shouldEvaluate) {
      const context = await buildNikkiContext(user.uid, now, clientTimezone);
      const decision = decideNikkiNudge(context);
      if (decision.shouldSpeak) {
        const evaluated = await speakNikkiNudge(context, decision);
        if (evaluated) {
          if (evaluated.status !== "delivered") {
            evaluated.status = "delivered";
            evaluated.deliveredAt = now;
            await evaluated.save();
          }
          if (decision.trigger === "sleep_reminder" && decision.triggerContext?.isSnoozeRepeat) {
            await NotificationPreferenceModel.updateOne(
              { firebaseUid: user.uid },
              { $set: { sleepSnoozeUntil: null } }
            ).catch(() => {});
          }
          return NextResponse.json({ data: serializeNudge(evaluated, snoozeMinutes) });
        }
      }
    }

    return NextResponse.json({ data: null });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Nudge] GET error:", error);
    return NextResponse.json({ error: { message: "Failed to fetch pending nudge.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

/**
 * POST /api/nikki/nudge
 *
 * Triggered ONLY when the opt-in desktop long-laptop-session timer reaches its
 * interval with local idle-time tracking. Receives only `{ activeMinutes, timezone }`
 * — never app names, window titles, keystrokes, or screen data.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const activeMinutes = typeof body.activeMinutes === "number" ? Math.round(body.activeMinutes) : 90;
    const clientTimezone = typeof body.timezone === "string" ? body.timezone : null;

    await connectToDatabase();
    const now = new Date();
    const context = await buildNikkiContext(user.uid, now, clientTimezone);

    if (!context.proactiveEnabled || context.isPaused || context.isQuietHours) {
      return NextResponse.json({ data: null });
    }

    // Only nudge if the user actually has a pending task or unstarted timetable item
    const pendingItem = context.unstartedStartedItems[0];
    const pendingTask = context.pendingTasks[0];
    if (!pendingItem && !pendingTask) {
      return NextResponse.json({ data: null });
    }

    const lastGlobalMs = context.lastNudge ? new Date(context.lastNudge.createdAt).getTime() : null;
    if (!hasMinGapElapsed(lastGlobalMs, now.getTime(), MIN_GAP_BETWEEN_UNPROMPTED_MS)) {
      return NextResponse.json({ data: null });
    }

    const bucket = Math.floor(now.getTime() / (60 * 60 * 1000));
    const idempotencyKey = buildLongLaptopSessionIdempotencyKey(user.uid, context.localDate, bucket);

    const targetTitle = pendingItem?.title || pendingTask?.title || "your pending task";
    const nudge = await speakNikkiNudge(context, {
      shouldSpeak: true,
      trigger: "long_session",
      idempotencyKey,
      reason: `User has been continuously active for ~${activeMinutes}m with '${targetTitle}' pending.`,
      triggerContext: {
        activeMinutes,
        itemTitle: pendingItem?.title || pendingTask?.title,
        itemStart: pendingItem?.start,
        uniqueKey: pendingItem?.uniqueKey,
        scheduleId: pendingItem?.scheduleId,
        itemIndex: pendingItem?.itemIndex,
        taskId: pendingTask?.id,
        isLongLaptopSession: true,
      },
    });

    if (!nudge) {
      return NextResponse.json({ data: null });
    }

    if (nudge.status !== "delivered") {
      nudge.status = "delivered";
      nudge.deliveredAt = now;
      await nudge.save();
    }

    const prefs = await NotificationPreferenceModel.findOne({ firebaseUid: user.uid })
      .select("sleepReminderSnoozeMinutes")
      .lean();

    return NextResponse.json({ data: serializeNudge(nudge, prefs?.sleepReminderSnoozeMinutes ?? 25) });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Nudge] POST error:", error);
    return NextResponse.json({ error: { message: "Failed to trigger long-session nudge.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
