import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { validateAgentChatRequest } from "@/lib/validation/agentChat";
import { runAgent } from "@/lib/ai/agent";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import {
  GeminiNotConfiguredError,
  GeminiRequestError,
  InvalidAgentResponseError,
  AgentContextError,
  ConversationPersistenceError,
  InvalidConversationIdError,
} from "@/lib/ai/errors";
import { withDevDetail } from "@/lib/api/errorResponse";
import {
  getOrCreateActiveConversation,
  saveMessage,
  updateMessageSchedule,
  loadRecentHistory,
  saveEmotionObservation,
  updateConversationTitle,
} from "@/services/conversationService";
import { processMemoryCandidates } from "@/services/memoryService";
import { deriveTitleFromMessage } from "@/lib/conversation/titles";
import { generateAndPersistSchedule, resolveTargetDate } from "@/lib/schedule/generate";
import { deleteSchedule, getSchedule } from "@/services/scheduleService";
import type { ScheduleSummary } from "@/types/schedule";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // eslint-disable-next-line no-console
  console.log("[Companion] POST /api/agent/chat — request received");

  try {
    const user = await requireAuthenticatedUser(request);
    // eslint-disable-next-line no-console
    console.log(`[Companion] Authenticated user confirmed (uid: ${user.uid.slice(0, 6)}...)`);

    if (!isGeminiConfigured) {
      return NextResponse.json(
        {
          error: {
            message: "Your companion's AI isn't configured yet. GEMINI_API_KEY is missing from .env.local.",
            code: "GEMINI_NOT_CONFIGURED",
          },
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const { valid, errors, data } = validateAgentChatRequest(body);
    if (!valid || !data) {
      return NextResponse.json(
        { error: { message: errors.join(" "), code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const { conversation, isNew } = await getOrCreateActiveConversation(
      user.uid,
      data.conversationId,
      data.newConversation
    );

    if (!conversation?._id) {
      throw new InvalidConversationIdError("missing");
    }
    const conversationId = String(conversation._id);

    const userMessageDoc = await saveMessage({
      conversationId,
      firebaseUid: user.uid,
      role: "user",
      content: data.message,
    });

    if (isNew) {
      try {
        const title = deriveTitleFromMessage(data.message);
        await updateConversationTitle(conversationId, title);
      } catch (titleError) {
        // eslint-disable-next-line no-console
        console.error("[Companion] Conversation title update failed (non-fatal):", titleError);
      }
    }

    const recentHistory = await loadRecentHistory(conversationId, String(userMessageDoc._id));

    // eslint-disable-next-line no-console
    console.log("[Companion] Sending request to Gemini...");
    const agentResponse = await runAgent(user.uid, data.message, recentHistory, data.timezone);
    // eslint-disable-next-line no-console
    console.log(`[Companion] Gemini request completed (intent: ${agentResponse.intent})`);

    const assistantMessageDoc = await saveMessage({
      conversationId,
      firebaseUid: user.uid,
      role: "assistant",
      content: agentResponse.message,
    });

    // Emotion persistence: best-effort, never fatal to the chat turn.
    try {
      await saveEmotionObservation({
        firebaseUid: user.uid,
        conversationId,
        sourceMessageId: String(userMessageDoc._id),
        emotion: agentResponse.emotion.emotion,
        intensity: agentResponse.emotion.intensity,
        confidence: agentResponse.emotion.confidence,
        secondaryEmotion: agentResponse.emotion.secondaryEmotion,
      });
    } catch (emotionError) {
      // eslint-disable-next-line no-console
      console.error("[Companion] Emotion persistence failed (non-fatal):", emotionError);
    }

    // Memory candidate processing:
    // If the user explicitly asks to remember something, ensure it's captured with high confidence.
    const explicitRememberMatch = data.message.match(
      /(?:please\s+)?(?:remember|don't\s+forget|keep\s+in\s+mind|note\s+that)\s+(?:that\s+)?(.+)/i
    );
    const candidatesToProcess = [...agentResponse.memoryCandidates];

    if (explicitRememberMatch) {
      const explicitFact = explicitRememberMatch[1].trim().replace(/[.!?]+$/, "");
      const hasHighConfidenceCandidate = candidatesToProcess.some((c) => c.confidence >= 0.75);

      if (!hasHighConfidenceCandidate && explicitFact.length > 2) {
        const lowCandidate = candidatesToProcess.find((c) => c.confidence < 0.75);
        if (lowCandidate) {
          lowCandidate.confidence = 0.9;
          lowCandidate.type = "explicit_remember_request";
        } else {
          candidatesToProcess.push({
            type: "explicit_remember_request",
            content: explicitFact.charAt(0).toUpperCase() + explicitFact.slice(1),
            confidence: 0.9,
            reason: "User explicitly asked to remember this.",
          });
        }
      }
    }

    try {
      await processMemoryCandidates({
        firebaseUid: user.uid,
        conversationId,
        sourceMessageId: String(userMessageDoc._id),
        candidates: candidatesToProcess,
      });
    } catch (memoryError) {
      // eslint-disable-next-line no-console
      console.error("[Companion] Memory candidate processing failed (non-fatal):", memoryError);
    }

    // Structured timetable generation & deletion:
    let schedule: ScheduleSummary | null = null;
    let scheduleDeleted: string | null = null;

    if (agentResponse.intent === "timetable_delete") {
      try {
        const targetDate = resolveTargetDate(data.message, data.timezone ?? "UTC");
        const deleted = await deleteSchedule(user.uid, targetDate);
        if (deleted) {
          scheduleDeleted = targetDate;
        }
      } catch (deleteError) {
        // eslint-disable-next-line no-console
        console.error("[Companion] Schedule deletion failed (non-fatal to chat):", deleteError);
      }
    } else if (agentResponse.intent === "timetable_request" || agentResponse.intent === "reschedule_request") {
      try {
        schedule = await generateAndPersistSchedule(user.uid, data.message, recentHistory, data.timezone);
      } catch (scheduleError) {
        // eslint-disable-next-line no-console
        console.error("[Companion] Schedule generation failed (non-fatal to chat):", scheduleError);
      }
    } else if (agentResponse.intent === "timetable_save") {
      try {
        const targetDate = resolveTargetDate(data.message, data.timezone ?? "UTC");
        const existing = await getSchedule(user.uid, targetDate);
        if (existing) {
          schedule = existing;
        } else {
          schedule = await generateAndPersistSchedule(user.uid, data.message, recentHistory, data.timezone);
        }
      } catch (saveError) {
        // eslint-disable-next-line no-console
        console.error("[Companion] Timetable save failed (non-fatal to chat):", saveError);
      }
    }

    // Persist timetable relationship to this message artifact so it survives refresh & history
    if (schedule && assistantMessageDoc?._id) {
      try {
        await updateMessageSchedule(String(assistantMessageDoc._id), {
          scheduleId: schedule.id,
          scheduleDate: schedule.date,
          scheduleSnapshot: schedule,
        });
      } catch (updateError) {
        // eslint-disable-next-line no-console
        console.error("[Companion] Failed to attach schedule to message:", updateError);
      }
    }

    return NextResponse.json({
      data: {
        message: agentResponse.message,
        intent: agentResponse.intent,
        actions: agentResponse.actions,
        needsClarification: agentResponse.needsClarification,
        conversationId,
        schedule,
        scheduleDeleted,
      },
    });
  } catch (error) {
    return handleAgentError(error);
  }
}

function handleAgentError(error: unknown): Response {
  try {
    // eslint-disable-next-line no-console
    console.error(
      `[Companion] POST /api/agent/chat failed — actual error constructor: ${
        (error as { constructor?: { name?: string } })?.constructor?.name ?? "unknown"
      }`,
      error
    );

    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }

    if (error instanceof GeminiNotConfiguredError) {
      return NextResponse.json(
        { error: { message: "Your companion's AI isn't configured yet.", code: "GEMINI_NOT_CONFIGURED" } },
        { status: 500 }
      );
    }

    if (error instanceof GeminiRequestError) {
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Your companion couldn't reach its AI provider just now.", error),
            code: "GEMINI_REQUEST_FAILED",
          },
        },
        { status: 502 }
      );
    }

    if (error instanceof InvalidAgentResponseError) {
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Your companion's response didn't come back in the expected format.", error),
            code: "INVALID_GEMINI_RESPONSE",
          },
        },
        { status: 502 }
      );
    }

    if (error instanceof AgentContextError) {
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Couldn't load your context for your companion.", error),
            code: "CONTEXT_FAILURE",
          },
        },
        { status: 500 }
      );
    }

    if (error instanceof InvalidConversationIdError) {
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Companion couldn't identify which conversation to save that to.", error),
            code: "INVALID_CONVERSATION_ID",
          },
        },
        { status: 400 }
      );
    }

    if (error instanceof ConversationPersistenceError) {
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Companion couldn't save your conversation just now.", error),
            code: "CONVERSATION_PERSISTENCE_FAILED",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Something went wrong talking to your companion.", error),
          code: "UNKNOWN_ERROR",
        },
      },
      { status: 500 }
    );
  } catch (handlerError) {
    // eslint-disable-next-line no-console
    console.error("[Companion] handleAgentError itself threw:", handlerError);
    return new Response(
      JSON.stringify({
        error: { message: "Something went wrong on our end. Please try again.", code: "FATAL_HANDLER_ERROR" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
