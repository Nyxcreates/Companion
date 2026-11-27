import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";
import { NotificationModel } from "@/models/Notification";
import { claimNotificationIdempotency } from "@/models/NotificationIdempotency";
import { ScheduleModel } from "@/models/Schedule";
import { TaskModel } from "@/models/Task";
import { UserModel } from "@/models/User";
import { resolveUserTimezone } from "@/lib/time/currentTime";

export const runtime = "nodejs";

const PACKAGE_LABELS: Record<string, string> = {
  "com.instagram.android": "Instagram",
  "com.google.android.youtube": "YouTube",
  "com.zhiliaoapp.musically": "TikTok",
  "com.reddit.frontpage": "Reddit",
  "com.twitter.android": "X",
  "com.facebook.katana": "Facebook",
};

function isQuietHours(start: string | null | undefined, end: string | null | undefined, tz: string): boolean {
  if (!start || !end) return false;
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const currentMins = hour * 60 + minute;

    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const startMins = startH * 60 + (startM || 0);
    const endMins = endH * 60 + (endM || 0);

    if (startMins <= endMins) {
      return currentMins >= startMins && currentMins < endMins;
    }
    return currentMins >= startMins || currentMins < endMins;
  } catch {
    return false;
  }
}

/**
 * Evaluates whether the user is currently distracted on their phone during a
 * scheduled study/task block or while an urgent task is due.
 *
 * Called by Android's AppUsageTrackerService.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));

    const distractingMinutes =
      typeof body.distractingMinutes === "number" ? body.distractingMinutes : 0;
    const foregroundPackage =
      typeof body.foregroundPackage === "string" ? body.foregroundPackage : "";
    const clientTz = typeof body.timezone === "string" ? body.timezone : null;

    await connectToDatabase();

    const [userProfile, prefs] = await Promise.all([
      UserModel.findOne({ firebaseUid: user.uid }),
      NotificationPreferenceModel.findOne({ firebaseUid: user.uid }),
    ]);

    const tz = resolveUserTimezone(clientTz, userProfile?.timezone);
    const now = new Date();

    if (prefs?.proactiveEnabled === false) {
      return NextResponse.json({ data: { shouldNudge: false, reason: "proactive_disabled" } });
    }
    if (prefs?.pausedUntil && new Date(prefs.pausedUntil) > now) {
      return NextResponse.json({ data: { shouldNudge: false, reason: "paused" } });
    }
    if (isQuietHours(prefs?.quietHoursStart, prefs?.quietHoursEnd, tz)) {
      return NextResponse.json({ data: { shouldNudge: false, reason: "quiet_hours" } });
    }

    // Compute local clock and date in user's timezone
    let localHour = 0;
    let localMinute = 0;
    let todayStr = "";
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(now);
      localHour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
      localMinute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
      todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
    } catch {
      localHour = now.getUTCHours();
      localMinute = now.getUTCMinutes();
      todayStr = now.toISOString().slice(0, 10);
    }

    const currentMinutes = localHour * 60 + localMinute;
    const todaySchedule = await ScheduleModel.findOne({ firebaseUid: user.uid, date: todayStr });

    let activeBlockTitle: string | null = null;
    let activeBlockEnd: string | null = null;

    if (todaySchedule?.items?.length) {
      for (const item of todaySchedule.items) {
        if (!item.start || !item.end || item.type === "free") continue;
        const [sH, sM] = item.start.split(":").map(Number);
        const [eH, eM] = item.end.split(":").map(Number);
        const startMins = sH * 60 + (sM || 0);
        const endMins = eH * 60 + (eM || 0);

        if (currentMinutes >= startMins && currentMinutes < endMins) {
          activeBlockTitle = item.title;
          activeBlockEnd = item.end;
          break;
        }
      }
    }

    // Fallback: check urgent/overdue pending tasks if no active timetable block
    let urgentTaskTitle: string | null = null;
    if (!activeBlockTitle) {
      const soon = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      const urgentTask = await TaskModel.findOne({
        firebaseUid: user.uid,
        status: "PENDING",
        $or: [{ dueDate: { $ne: null, $lte: soon } }, { priority: "HIGH" }],
      }).sort({ dueDate: 1 });

      if (urgentTask) {
        urgentTaskTitle = urgentTask.title;
      }
    }

    const targetTitle = activeBlockTitle || urgentTaskTitle;
    const appLabel = PACKAGE_LABELS[foregroundPackage] || "your phone";
    const userName = userProfile?.displayName?.trim() || "friend";

    // Case 1: User is on a distracting app during an active study/task block or with an urgent task
    if (targetTitle && distractingMinutes >= 3) {
      const bucket15m = Math.floor(now.getTime() / (15 * 60 * 1000));
      const claimed = await claimNotificationIdempotency(
        `${user.uid}:phone_distraction:${todayStr}:${bucket15m}`,
        user.uid,
        "android_usage",
        15 * 60 * 1000
      );

      if (!claimed) {
        return NextResponse.json({ data: { shouldNudge: false, reason: "cooldown" } });
      }

      const title = `Put ${appLabel === "your phone" ? "the phone" : appLabel} down, ${userName} 📚`;
      const bodyText = activeBlockTitle
        ? `You scheduled "${activeBlockTitle}" right now${activeBlockEnd ? ` (until ${activeBlockEnd})` : ""}. Leave ${appLabel} and let's get it done!`
        : `You still have "${targetTitle}" waiting to be completed. Put ${appLabel} aside for a bit and make progress!`;

      await NotificationModel.create({
        firebaseUid: user.uid,
        category: "focus_reminder",
        title,
        body: bodyText,
        actionUrl: activeBlockTitle ? "/plan?tab=schedule" : "/plan",
        actionLabel: "Back to Task",
        metadata: {
          source: "android_usage",
          foregroundPackage,
          targetTitle,
        },
      });

      return NextResponse.json({
        data: {
          shouldNudge: true,
          taskTitle: targetTitle,
          itemEnd: activeBlockEnd,
          title,
          body: bodyText,
        },
      });
    }

    // Case 2: No active study/task block — only nudge after 20+ minutes of distracting scrolling
    if (distractingMinutes >= 20) {
      const bucket30m = Math.floor(now.getTime() / (30 * 60 * 1000));
      const claimed = await claimNotificationIdempotency(
        `${user.uid}:phone_scroll:${todayStr}:${bucket30m}`,
        user.uid,
        "android_usage",
        30 * 60 * 1000
      );

      if (!claimed) {
        return NextResponse.json({ data: { shouldNudge: false, reason: "cooldown" } });
      }

      return NextResponse.json({
        data: {
          shouldNudge: true,
          title: "Heyyy, quick breather? 🌿",
          body: `You've been on ${appLabel} for a while. Want to grab some water or rest your eyes?`,
        },
      });
    }

    return NextResponse.json({ data: { shouldNudge: false, reason: "within_threshold" } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : "Distraction check failed.";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
