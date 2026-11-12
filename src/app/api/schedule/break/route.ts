import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import {
  startBreak,
  getActiveBreak,
  cancelBreak,
} from "@/services/breakSessionService";

export const runtime = "nodejs";

/** GET /api/schedule/break — returns the current active break, or null */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const session = await getActiveBreak(user.uid);
    return NextResponse.json({
      data: session
        ? {
            id: String(session._id),
            endsAt: session.endsAt.toISOString(),
            status: session.status,
            extensionUsed: session.extensionUsed,
            extensionEndsAt: session.extensionEndsAt?.toISOString() ?? null,
            nextTaskTitle: session.nextTaskTitle,
            durationMinutes: session.durationMinutes,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Break] GET error:", error);
    return NextResponse.json({ error: { message: "Failed to fetch break session.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

/**
 * POST /api/schedule/break — start a break
 * Body: { durationMinutes: number, nextTaskTitle?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));

    const durationMinutes = Number(body.durationMinutes);
    if (!durationMinutes || durationMinutes < 1 || durationMinutes > 480) {
      return NextResponse.json(
        { error: { message: "durationMinutes must be between 1 and 480.", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const session = await startBreak({
      firebaseUid: user.uid,
      durationMinutes,
      nextTaskTitle: typeof body.nextTaskTitle === "string" ? body.nextTaskTitle : null,
    });

    return NextResponse.json(
      {
        data: {
          id: String(session._id),
          endsAt: session.endsAt.toISOString(),
          status: session.status,
          extensionUsed: session.extensionUsed,
          extensionEndsAt: null,
          nextTaskTitle: session.nextTaskTitle,
          durationMinutes: session.durationMinutes,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Break] POST error:", error);
    return NextResponse.json({ error: { message: "Failed to start break.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

/** DELETE /api/schedule/break — cancel the active break */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    await cancelBreak(user.uid);
    return NextResponse.json({ data: { cancelled: true } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Break] DELETE error:", error);
    return NextResponse.json({ error: { message: "Failed to cancel break.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

