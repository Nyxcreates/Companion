import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { NikkiNudgeModel } from "@/models/NikkiNudge";

export const runtime = "nodejs";

/**
 * POST /api/nikki/nudge/dismiss
 *
 * Marks a nudge as "dismissed", which feeds into the back-off logic.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const nudgeId = typeof body.nudgeId === "string" ? body.nudgeId : undefined;

    if (!nudgeId) {
      return NextResponse.json({ error: { message: "nudgeId is required.", code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    await connectToDatabase();
    const nudge = await NikkiNudgeModel.findOneAndUpdate(
      { _id: nudgeId, firebaseUid: user.uid },
      { $set: { status: "dismissed" } },
      { new: true }
    );

    return NextResponse.json({ success: true, data: { status: nudge?.status ?? "dismissed" } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Nudge Dismiss] Error:", error);
    return NextResponse.json({ error: { message: "Failed to dismiss nudge.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
