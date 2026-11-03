import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { evaluateProactiveContext, getUnreadNotificationCount, listUserNotifications } from "@/services/notificationService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const timezone = typeof body.timezone === "string" ? body.timezone : "UTC";

    const { newNotificationsCount, activeCheckIn } = await evaluateProactiveContext(user.uid, timezone);
    const [notifications, unreadCount] = await Promise.all([
      listUserNotifications(user.uid, { limit: 50 }),
      getUnreadNotificationCount(user.uid),
    ]);

    return NextResponse.json({
      data: {
        newNotificationsCount,
        activeCheckIn,
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to evaluate notifications.";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

