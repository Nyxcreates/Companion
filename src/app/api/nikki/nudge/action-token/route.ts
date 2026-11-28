import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { NikkiNudgeModel } from "@/models/NikkiNudge";
import { verifyNudgeActionToken } from "@/lib/nikki/actionToken";

export const runtime = "nodejs";

/**
 * POST /api/nikki/nudge/action-token
 *
 * Executes an owner-scoped nudge action ("done" | "acknowledge" | "snooze" | "dismiss")
 * authorized by an HMAC-signed token (used by Desktop native notifications and Push SW).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : request.nextUrl.searchParams.get("token") || "";
    const payload = verifyNudgeActionToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: { message: "Invalid or expired action token.", code: "INVALID_TOKEN" } },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const now = new Date();
    const isCompleted = payload.action === "done" || payload.action === "acknowledge";
    const snoozeMinutes = Math.max(5, Math.min(120, Math.round(payload.minutes ?? 15)));

    if (payload.nudgeId) {
      const update: Record<string, unknown> =
        payload.action === "snooze"
          ? {
              status: "snoozed",
              snoozedUntil: new Date(now.getTime() + snoozeMinutes * 60_000),
            }
          : isCompleted
          ? {
              status: "done",
              snoozedUntil: null,
              completedAt: now,
            }
          : {
              status: "dismissed",
              snoozedUntil: null,
            };

      const updated = await NikkiNudgeModel.findOneAndUpdate(
        { _id: payload.nudgeId, firebaseUid: payload.uid },
        { $set: update },
        { new: true }
      );

      if (!updated) {
        return NextResponse.json(
          { error: { message: "Nudge not found.", code: "NOT_FOUND" } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          nudgeId: String(updated._id),
          action: payload.action,
          status: updated.status,
          snoozedUntil: updated.snoozedUntil ? updated.snoozedUntil.toISOString() : null,
        },
      });
    }

    return NextResponse.json({ success: true, data: { action: payload.action } });
  } catch (error) {
    console.error("[Companion Nudge ActionToken] error:", error);
    return NextResponse.json(
      { error: { message: "Failed to process nudge action.", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
