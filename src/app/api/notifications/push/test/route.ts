import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { sendPushToUser } from "@/lib/pushService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));

    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Nikki";
    const message =
      typeof body.body === "string" && body.body.trim()
        ? body.body.trim()
        : "Hey! Just testing that my check-ins reach your device even when Companion is closed ✨";
    const url = typeof body.url === "string" && body.url ? body.url : "/dashboard";

    const result = await sendPushToUser(user.uid, {
      title,
      body: message,
      url,
      tag: "companion-test-notification",
    });

    return NextResponse.json({
      data: {
        success: result.success,
        sentCount: result.sentCount,
        removedCount: result.removedCount,
        totalSubscriptions: result.totalSubscriptions ?? 0,
        reason: result.reason,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Test push delivery failed.";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
