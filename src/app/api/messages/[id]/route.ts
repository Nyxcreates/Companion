import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import {
  updateUserMessage,
  loadHistoryBeforeDate,
  findSubsequentAssistantMessage,
  saveMessage,
} from "@/services/conversationService";
import { runAgent } from "@/lib/ai/agent";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { generateAndPersistSchedule } from "@/lib/schedule/generate";
import { withDevDetail } from "@/lib/api/errorResponse";
import type { ScheduleSummary } from "@/types/schedule";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 2000;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: messageId } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const body = (await request.json().catch(() => null)) as {
      message?: unknown;
      regenerate?: unknown;
      timezone?: unknown;
    } | null;

    if (!body || typeof body.message !== "string" || body.message.trim().length === 0) {
      return NextResponse.json(
        { error: { message: "Message text is required.", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    if (body.message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: { message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`, code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const trimmedMessage = body.message.trim();
    const shouldRegenerate = body.regenerate !== false; // default to true
    const clientTimezone = typeof body.timezone === "string" ? body.timezone : undefined;

    const updatedUserMsg = await updateUserMessage(messageId, user.uid, trimmedMessage);
    if (!updatedUserMsg) {
      return NextResponse.json(
        { error: { message: "Message not found or cannot be edited.", code: "MESSAGE_NOT_FOUND" } },
        { status: 404 }
      );
    }

    const convId = String(updatedUserMsg.conversationId);
    let assistantMessageData: { id: string; role: "nikki"; text: string; schedule?: ScheduleSummary } | null = null;

    if (shouldRegenerate && isGeminiConfigured) {
      try {
        const priorHistory = await loadHistoryBeforeDate(convId, updatedUserMsg.createdAt);
        const agentResponse = await runAgent(user.uid, trimmedMessage, priorHistory, clientTimezone);

        let schedule: ScheduleSummary | null = null;
        if (agentResponse.intent === "timetable_request" || agentResponse.intent === "reschedule_request") {
          try {
            schedule = await generateAndPersistSchedule(user.uid, trimmedMessage, priorHistory, clientTimezone);
          } catch (scheduleError) {
            // eslint-disable-next-line no-console
            console.error("[Companion] Schedule regeneration failed (non-fatal):", scheduleError);
          }
        }

        const nextAssistant = await findSubsequentAssistantMessage(convId, updatedUserMsg.createdAt);
        if (nextAssistant) {
          nextAssistant.content = agentResponse.message;
          if (schedule) {
            nextAssistant.scheduleId = schedule.id as unknown as typeof nextAssistant.scheduleId;
            nextAssistant.scheduleDate = schedule.date;
            nextAssistant.scheduleSnapshot = schedule as unknown as typeof nextAssistant.scheduleSnapshot;
          }
          await nextAssistant.save();
          assistantMessageData = {
            id: String(nextAssistant._id),
            role: "nikki",
            text: nextAssistant.content,
            schedule: schedule ?? (nextAssistant.scheduleSnapshot as unknown as ScheduleSummary) ?? undefined,
          };
        } else {
          const newAssistantDoc = await saveMessage({
            conversationId: convId,
            firebaseUid: user.uid,
            role: "assistant",
            content: agentResponse.message,
            scheduleId: schedule?.id ?? null,
            scheduleDate: schedule?.date ?? null,
            scheduleSnapshot: schedule ?? null,
          });
          assistantMessageData = {
            id: String(newAssistantDoc._id),
            role: "nikki",
            text: newAssistantDoc.content,
            schedule: schedule ?? undefined,
          };
        }
      } catch (genError) {
        // eslint-disable-next-line no-console
        console.error("[Companion] Failed to regenerate assistant response after message edit:", genError);
      }
    }

    return NextResponse.json({
      data: {
        message: {
          id: String(updatedUserMsg._id),
          role: "user",
          text: updatedUserMsg.content,
          createdAt: updatedUserMsg.createdAt.toISOString(),
        },
        assistantMessage: assistantMessageData,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }

    // eslint-disable-next-line no-console
    console.error("[Companion] PATCH /api/messages/[id] failed:", error);
    return NextResponse.json(
      { error: { message: withDevDetail("Failed to edit message.", error), code: "UNKNOWN_ERROR" } },
      { status: 500 }
    );
  }
}
