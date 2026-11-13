import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { NikkiNudgeModel } from "@/models/NikkiNudge";

export const runtime = "nodejs";

/**
 * GET /api/nikki/nudge
 *
 * Fetches the latest pending/undismissed NikkiNudge for the current user.
 * Marks it as "delivered" if it was "created".
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    await connectToDatabase();

    const nudge = await NikkiNudgeModel.findOne({
      firebaseUid: user.uid,
      status: { $in: ["created", "delivered"] },
    }).sort({ createdAt: -1 });

    if (!nudge) {
      return NextResponse.json({ data: null });
    }

    if (nudge.status === "created") {
      nudge.status = "delivered";
      await nudge.save();
    }

    return NextResponse.json({
      data: {
        id: String(nudge._id),
        trigger: nudge.trigger,
        message: nudge.message,
        status: nudge.status,
        strictness: nudge.strictness,
        metadata: nudge.metadata || {},
        createdAt: nudge.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Nudge] GET error:", error);
    return NextResponse.json({ error: { message: "Failed to fetch pending nudge.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
