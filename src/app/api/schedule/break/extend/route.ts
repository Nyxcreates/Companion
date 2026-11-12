import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { extendBreak } from "@/services/breakSessionService";

export const runtime = "nodejs";

/** POST /api/schedule/break/extend — extend the active break by 5 minutes (once) */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const session = await extendBreak(user.uid);

    if (!session) {
      return NextResponse.json(
        { error: { message: "No active break to extend, or already extended once.", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: String(session._id),
        endsAt: session.endsAt.toISOString(),
        status: session.status,
        extensionUsed: session.extensionUsed,
        extensionEndsAt: session.extensionEndsAt?.toISOString() ?? null,
        nextTaskTitle: session.nextTaskTitle,
        durationMinutes: session.durationMinutes,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Break] extend error:", error);
    return NextResponse.json({ error: { message: "Failed to extend break.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

