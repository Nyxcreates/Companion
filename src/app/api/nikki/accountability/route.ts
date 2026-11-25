import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { executeAccountabilityAction } from "@/lib/nikki/accountabilitySupport";

export const runtime = "nodejs";

export type AccountabilityAction =
  | "break_task"
  | "reschedule_task"
  | "adjust_goal"
  | "complete_task"
  | "complete_goal"
  | "change_priority"
  | "focus_now"
  | "ask_blocker"
  | "rest_support";

/**
 * POST /api/nikki/accountability
 *
 * Executes a goal/task accountability action Nikki proposes in conversation:
 *   - break_task:     Creates up to 5 sub-tasks linked to the parent task's goal
 *   - reschedule_task: Updates the task's dueDate
 *   - adjust_goal:    Updates the goal's deadline or target
 *   - complete_task:  Marks a task as completed with completedAt
 *   - complete_goal:  Marks a goal as completed with completedAt
 *   - change_priority: Updates task/goal priority
 *   - focus_now:      No-op (handled client-side — opens focus mode)
 *   - ask_blocker:    No-op (handled client-side — opens chat)
 *   - rest_support:   Validates rest without guilt and optionally adjusts task
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? (body.action as AccountabilityAction) : null;
    const targetId = typeof body.targetId === "string" ? body.targetId.trim() : null;
    const targetType = body.targetType === "goal" ? "goal" : "task";
    const payload = body.payload || {};

    const validActions: AccountabilityAction[] = [
      "break_task",
      "reschedule_task",
      "adjust_goal",
      "complete_task",
      "complete_goal",
      "change_priority",
      "focus_now",
      "ask_blocker",
      "rest_support",
    ];

    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ error: { message: "Invalid action.", code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    if (!targetId && action !== "focus_now" && action !== "ask_blocker" && action !== "rest_support") {
      return NextResponse.json({ error: { message: "targetId is required.", code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    // Client-side no-ops
    if (action === "focus_now" || action === "ask_blocker") {
      return NextResponse.json({ data: { ok: true, action } });
    }

    // Rest support without targetId
    if (action === "rest_support" && !targetId) {
      return NextResponse.json({ data: { ok: true, action, message: "Rest acknowledged without guilt." } });
    }

    const result = await executeAccountabilityAction({
      action,
      firebaseUid: user.uid,
      targetId: targetId || "",
      targetType,
      payload,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: { message: result.error || "Action failed.", code: "ACTION_FAILED" } },
        { status: 400 }
      );
    }

    // Refresh Nikki's context after database changes
    const { buildNikkiContext } = await import("@/lib/nikki/context");
    const refreshed = await buildNikkiContext(user.uid).catch(() => null);

    return NextResponse.json({
      data: {
        ...result,
        contextUpdated: Boolean(refreshed),
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Accountability] POST error:", error);
    return NextResponse.json({ error: { message: "Failed to execute accountability action.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
