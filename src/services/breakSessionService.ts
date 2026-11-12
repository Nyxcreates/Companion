import { connectToDatabase } from "@/lib/mongodb";
import { BreakSessionModel, type BreakSessionDocument } from "@/models/BreakSession";
import { UserModel } from "@/models/User";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";
import { sendPushToUser } from "@/lib/pushService";
import { resolveUserTimezone } from "@/lib/time/currentTime";

// ─── Shared quiet-hours helper (mirrors timetableReminderService) ─────────────
function isQuietHours(start: string | null, end: string | null, tz: string): boolean {
  if (!start || !end) return false;
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hour   = parseInt(parts.find((p) => p.type === "hour")?.value   ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const currentMins = hour * 60 + minute;
    const [startH, startM] = start.split(":").map(Number);
    const [endH,   endM]   = end.split(":").map(Number);
    const startMins = startH * 60 + (startM || 0);
    const endMins   = endH   * 60 + (endM   || 0);
    if (startMins <= endMins) return currentMins >= startMins && currentMins < endMins;
    return currentMins >= startMins || currentMins < endMins;
  } catch {
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a break for the user.
 * Cancels any currently-active break first (idempotent start).
 */
export async function startBreak(params: {
  firebaseUid: string;
  durationMinutes: number;
  nextTaskTitle?: string | null;
}): Promise<BreakSessionDocument> {
  await connectToDatabase();

  // Cancel any existing active / extended break so there's only one at a time
  await BreakSessionModel.updateMany(
    { firebaseUid: params.firebaseUid, status: { $in: ["active", "extended"] } },
    { $set: { status: "cancelled" } }
  );

  const endsAt = new Date(Date.now() + params.durationMinutes * 60 * 1000);

  const session = await BreakSessionModel.create({
    firebaseUid: params.firebaseUid,
    endsAt,
    status: "active",
    extensionUsed: false,
    extensionEndsAt: null,
    nextTaskTitle: params.nextTaskTitle ?? null,
    durationMinutes: params.durationMinutes,
    endNotificationSent: false,
  });

  return session;
}

/**
 * Returns the current active/extended break for the user, or null.
 */
export async function getActiveBreak(
  firebaseUid: string
): Promise<BreakSessionDocument | null> {
  await connectToDatabase();
  return BreakSessionModel.findOne({
    firebaseUid,
    status: { $in: ["active", "extended"] },
  }).sort({ createdAt: -1 });
}

/**
 * Cancel the active break immediately.
 */
export async function cancelBreak(firebaseUid: string): Promise<boolean> {
  await connectToDatabase();
  const result = await BreakSessionModel.updateMany(
    { firebaseUid, status: { $in: ["active", "extended"] } },
    { $set: { status: "cancelled" } }
  );
  return result.modifiedCount > 0;
}

/**
 * Extend the active break by 5 minutes.
 * Only allowed once per session (extensionUsed guard).
 * Returns the updated session, or null if no active break or already extended.
 */
export async function extendBreak(
  firebaseUid: string
): Promise<BreakSessionDocument | null> {
  await connectToDatabase();

  const session = await BreakSessionModel.findOne({
    firebaseUid,
    status: { $in: ["active", "extended"] },
  }).sort({ createdAt: -1 });

  if (!session) return null;
  if (session.extensionUsed) return null; // already extended once

  const extensionEndsAt = new Date(Date.now() + 5 * 60 * 1000);
  session.extensionUsed   = true;
  session.extensionEndsAt = extensionEndsAt;
  session.status          = "extended";
  session.endNotificationSent = false; // allow a fresh end notification
  await session.save();

  return session;
}

/**
 * Dispatch break-end (and extension-end) push notifications for all due breaks.
 * Called by /api/cron/dispatch every 5 minutes.
 *
 * Logic:
 *  - For "active" sessions where endsAt <= now and extensionUsed=false
 *    → push "break ended" (offer one extension)
 *    → mark endNotificationSent=true; keep status="active" so the user can still extend
 *
 *  - For "extended" sessions where extensionEndsAt <= now
 *    → push gentle "ready when you are" nudge
 *    → mark status="ended"
 *
 * Respects quiet hours and per-category settings.
 */
export async function dispatchDueBreaks(): Promise<{
  endNotificationsSent: number;
  extensionEndNotificationsSent: number;
}> {
  await connectToDatabase();

  const now = new Date();
  let endNotificationsSent = 0;
  let extensionEndNotificationsSent = 0;

  // ── 1. Break ended (original) ─────────────────────────────────────────────
  const dueBreaks = await BreakSessionModel.find({
    status: "active",
    endsAt: { $lte: now },
    endNotificationSent: false,
  });

  for (const session of dueBreaks) {
    // Preference check
    const prefs = await NotificationPreferenceModel.findOne({ firebaseUid: session.firebaseUid });
    if (prefs?.proactiveEnabled === false) {
      session.status = "ended";
      await session.save();
      continue;
    }
    if (prefs?.pausedUntil && new Date(prefs.pausedUntil) > now) {
      session.status = "ended";
      await session.save();
      continue;
    }
    const user = await UserModel.findOne({ firebaseUid: session.firebaseUid });
    const tz   = resolveUserTimezone(null, user?.timezone);
    if (isQuietHours(prefs?.quietHoursStart ?? null, prefs?.quietHoursEnd ?? null, tz)) {
      session.status = "ended";
      await session.save();
      continue;
    }
    // Category check
    const breakEnabled = prefs?.categoriesEnabled
      ? (prefs.categoriesEnabled as unknown as Map<string, boolean>).get?.("break_reminder") ?? true
      : true;
    if (!breakEnabled) {
      session.status = "ended";
      await session.save();
      continue;
    }

    const displayName = user?.displayName || "there";
    const nextTask    = session.nextTaskTitle;
    const title  = "Break's over! 🌟";
    const body   = nextTask
      ? `Hey ${displayName}, break time's up — ready to get back to "${nextTask}"?`
      : `Hey ${displayName}, your break has ended! Take it at your own pace — I'm here whenever you're ready ✨`;

    await sendPushToUser(session.firebaseUid, {
      title,
      body,
      url:      "/plan?tab=schedule",
      tag:      `break-end-${String(session._id)}`,
      category: "break_reminder",
      actions: [
        { action: "break-back",   title: "Back to it 💪" },
        { action: "break-extend", title: "5 more minutes" },
      ],
      data: { breakSessionId: String(session._id) },
    });

    session.endNotificationSent = true;
    await session.save();
    endNotificationsSent++;
  }

  // ── 2. Extension ended ────────────────────────────────────────────────────
  const dueExtensions = await BreakSessionModel.find({
    status: "extended",
    extensionEndsAt: { $lte: now },
    endNotificationSent: false,
  });

  for (const session of dueExtensions) {
    const prefs = await NotificationPreferenceModel.findOne({ firebaseUid: session.firebaseUid });
    if (prefs?.proactiveEnabled === false) {
      session.status = "ended";
      await session.save();
      continue;
    }
    if (prefs?.pausedUntil && new Date(prefs.pausedUntil) > now) {
      session.status = "ended";
      await session.save();
      continue;
    }
    const user = await UserModel.findOne({ firebaseUid: session.firebaseUid });
    const tz   = resolveUserTimezone(null, user?.timezone);
    if (isQuietHours(prefs?.quietHoursStart ?? null, prefs?.quietHoursEnd ?? null, tz)) {
      session.status = "ended";
      await session.save();
      continue;
    }
    const breakEnabled = prefs?.categoriesEnabled
      ? (prefs.categoriesEnabled as unknown as Map<string, boolean>).get?.("break_reminder") ?? true
      : true;
    if (!breakEnabled) {
      session.status = "ended";
      await session.save();
      continue;
    }

    const displayName = user?.displayName || "there";
    const nextTask    = session.nextTaskTitle;
    const title  = "Still here with you 💙";
    const body   = nextTask
      ? `No rush, ${displayName} — whenever you're ready, "${nextTask}" will be waiting!`
      : `No rush, ${displayName}. I'll be right here whenever you're ready to dive back in 🌙`;

    await sendPushToUser(session.firebaseUid, {
      title,
      body,
      url:      "/plan?tab=schedule",
      tag:      `break-extension-end-${String(session._id)}`,
      category: "break_reminder",
      actions: [
        { action: "break-back", title: "Let's go! 🚀" },
      ],
      data: { breakSessionId: String(session._id) },
    });

    session.endNotificationSent = true;
    session.status = "ended";
    await session.save();
    extensionEndNotificationsSent++;
  }

  return { endNotificationsSent, extensionEndNotificationsSent };
}

