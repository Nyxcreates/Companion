import { connectToDatabase } from "@/lib/mongodb";
import { NikkiNudgeModel, type NikkiNudgeDocument } from "@/models/NikkiNudge";
import { createNotification } from "@/services/notificationService";
import { generateAgentReply, isGeminiConfigured } from "@/lib/ai/gemini";
import type { NikkiContextSnapshot } from "./context";
import type { NikkiDecision } from "./decide";
import {
  buildNikkiSystemPersona,
  buildNikkiScenarioPrompt,
  getPersonaFallbackMessage,
  getRecentNudgeMessages,
} from "./persona";

export {
  buildNikkiSystemPersona,
  buildNikkiScenarioPrompt,
  getPersonaFallbackMessage,
  getRecentNudgeMessages,
};

/**
 * Initiates an in-character message when a trigger fires:
 * 1. Fetches recent nudges sent in the past 7 days to enforce zero verbatim repetition.
 * 2. Generates speech via Gemini with Nikki's proactive persona (or selects varied 7-day-unique fallback).
 * 3. Persists in NikkiNudgeModel (owner-scoped & idempotent).
 * 4. Dispatches via existing notification & web push channels.
 */
export async function speakNikkiNudge(
  context: NikkiContextSnapshot,
  decision: NikkiDecision
): Promise<NikkiNudgeDocument | null> {
  if (!decision.shouldSpeak || !decision.trigger || !decision.idempotencyKey) {
    return null;
  }

  await connectToDatabase();

  // Idempotency check: don't create or send duplicate nudge
  const existingNudge = await NikkiNudgeModel.findOne({
    idempotencyKey: decision.idempotencyKey,
  });

  if (existingNudge) {
    return existingNudge;
  }

  // Load recent messages sent in the past 7 days to guarantee no verbatim repetition
  const recentMessagesSet = await getRecentNudgeMessages(context.firebaseUid, 7);
  const recentMessagesList = Array.from(recentMessagesSet);

  let messageText = "";

  // Attempt Gemini generation if API key is configured
  if (isGeminiConfigured) {
    try {
      const systemInstruction = buildNikkiSystemPersona({
        companionName: context.companionName,
        userName: context.userName,
        strictness: context.strictness,
        recentMessages: recentMessagesList,
      });

      const prompt = buildNikkiScenarioPrompt(context, decision);

      const raw = await generateAgentReply(systemInstruction, [], prompt);
      const parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
      if (typeof parsed?.message === "string") {
        const candidate = parsed.message.trim();
        // Check if candidate is non-empty and has NOT been sent in the past 7 days verbatim
        if (candidate.length > 0 && !recentMessagesSet.has(candidate)) {
          messageText = candidate;
        }
      }
    } catch (err) {
      console.warn("[Companion Nikki Speak] Gemini generation failed; using fallback:", err);
    }
  }

  // Fallback to rich, varied persona templates guaranteed not to repeat within 7 days
  if (!messageText) {
    messageText = getPersonaFallbackMessage(context, decision, recentMessagesSet);
  }

  // Persist NikkiNudge document
  const nudge = await NikkiNudgeModel.create({
    firebaseUid: context.firebaseUid,
    trigger: decision.trigger,
    message: messageText,
    status: "created",
    idempotencyKey: decision.idempotencyKey,
    strictness: context.strictness,
    metadata: decision.triggerContext || {},
  });

  // Reuse existing notification & push system
  try {
    await createNotification({
      firebaseUid: context.firebaseUid,
      category: "nikki_supportive",
      title: context.companionName,
      body: messageText,
      actionUrl: `/?openNikki=${String(nudge._id)}`,
      actionLabel: "Talk to Nikki",
      metadata: {
        nudgeId: String(nudge._id),
        trigger: decision.trigger,
        idempotencyKey: decision.idempotencyKey,
      },
    });

    nudge.status = "delivered";
    await nudge.save();
  } catch (err) {
    console.warn("[Companion Nikki Speak] Notification delivery failed:", err);
  }

  return nudge;
}
