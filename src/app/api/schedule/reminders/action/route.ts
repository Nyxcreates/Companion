import { NextRequest, NextResponse } from "next/server";
import { handleReminderAction } from "@/services/timetableReminderService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { reminderId, uniqueKey, action, firebaseUid } = body;

    if (!action || typeof action !== "string") {
      return NextResponse.json(
        { error: { message: "Action is required.", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const result = await handleReminderAction({
      reminderId,
      uniqueKey,
      action,
      firebaseUid,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: { message: "Reminder not found or action failed.", code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[Companion] Reminder action error:", error);
    return NextResponse.json(
      { error: { message: "Failed to record reminder action.", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}

