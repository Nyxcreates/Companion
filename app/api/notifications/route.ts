import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import {
  listUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  snoozeNotification,
  clearNotificationHistory,
} from "@/services/notificationService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const includeDismissed = searchParams.get("includeDismissed") === "true";
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const [notifications, unreadCount] = await Promise.all([
      listUserNotifications(user.uid, { includeDismissed, limit }),
      getUnreadNotificationCount(user.uid),
    ]);

    return NextResponse.json({
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const { action, notificationId, minutes } = body;

    if (action === "mark_all_read") {
      const res = await markAllNotificationsAsRead(user.uid);
      return NextResponse.json({ data: res });
    }

    if (action === "clear_history") {
      const res = await clearNotificationHistory(user.uid);
      return NextResponse.json({ data: res });
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: { message: "notificationId is required", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    if (action === "read") {
      const notif = await markNotificationAsRead(user.uid, notificationId);
      return NextResponse.json({ data: notif });
    }

    if (action === "dismiss") {
      const ok = await dismissNotification(user.uid, notificationId);
      return NextResponse.json({ data: { ok } });
    }

    if (action === "snooze") {
      const notif = await snoozeNotification(user.uid, notificationId, minutes || 30);
      return NextResponse.json({ data: notif });
    }

    return NextResponse.json(
      { error: { message: "Invalid action", code: "VALIDATION_ERROR" } },
      { status: 400 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

function handleRouteError(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Internal notification error.";
  return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
}

