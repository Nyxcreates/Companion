import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { updatePreferences } from "@/services/notificationService";

export const runtime = "nodejs";

/**
 * POST /api/nikki/heartbeat
 *
 * Records user activity in the app by updating lastSeenAt timestamp
 * on the user's notification preferences.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const now = new Date();
    await updatePreferences(user.uid, {
      lastSeenAt: now.toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        lastSeenAt: now.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Heartbeat] Error:", error);
    return NextResponse.json(
      { error: { message: "Failed to record heartbeat.", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

