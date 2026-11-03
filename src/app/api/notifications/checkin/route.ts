import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { recordCheckInResponse } from "@/services/notificationService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const { triggerType, message, action, interventionType } = body;

    if (!triggerType || !message || !action) {
      return NextResponse.json(
        { error: { message: "triggerType, message, and action are required", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    await recordCheckInResponse(user.uid, {
      triggerType,
      message,
      action,
      interventionType,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to record check-in response.";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

