import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { updatePreferences } from "@/services/notificationService";

export const runtime = "nodejs";

/**
 * POST /api/nikki/nudge/mute
 *
 * "Mute for now" control: pauses notifications for N hours (default 2 hours).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const hours = typeof body.hours === "number" && body.hours > 0 ? body.hours : 2;

    const pausedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    await updatePreferences(user.uid, {
      pausedUntil: pausedUntil.toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        pausedUntil: pausedUntil.toISOString(),
        hours,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Nudge Mute] Error:", error);
    return NextResponse.json({ error: { message: "Failed to mute.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
