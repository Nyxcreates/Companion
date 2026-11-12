import { connectToDatabase } from "@/lib/mongodb";
import { NikkiNudgeModel, type NikkiNudgeDocument } from "@/models/NikkiNudge";
import { createNotification } from "@/services/notificationService";
import { generateAgentReply, isGeminiConfigured } from "@/lib/ai/gemini";
import type { NikkiContextSnapshot } from "./context";
import type { NikkiDecision } from "./decide";

/**
 * Builds the system persona prompt for Nikki unprompted nudges.
 */
function buildSystemPersonaInstruction(
  companionName: string,
  userName: string,
  strictness: "gentle" | "playful" | "firm"
): string {
  const strictnessGuidance = {
    gentle: "Tone: Extra warm, soft, calming, low-pressure. Offer unconditional compassion and space. Never push or create urgency.",
    playful: "Tone: Cheerful, friendly, lightly teasing, curious and upbeat. Bring positive energy.",
    firm: "Tone: Direct, clear, loving accountability. Keep it focused on execution and intentional choices, without any guilt, scolding, or judgment.",
  }[strictness];

  return `
You are ${companionName}, the user's caring companion in Companion.
The user's name is ${userName}.

Your Core Personality:
- Empathetic, authentic, human, caring.
- You speak in short, natural sentences — never formal, robotic, or like a corporate productivity bot.
- You NEVER diagnose psychological states, moods, or mental health (e.g., never say depression, ADHD, anxiety).
- You NEVER guilt-trip, shame, or say the user failed or is falling behind.
- ${strictnessGuidance}

Response Constraints:
1. Write EXACTLY 1 to 3 short sentences.
2. End with an open question or a gentle invitation/prompt (e.g. "Want to start with five minutes?", "How is your morning feeling?").
3. NEVER provide bullet points, numbered lists, or multiple-choice action options.
4. Output MUST be valid JSON in this exact shape:
   {
     "message": "your in-character message here"
   }
`.trim();
}

/**
 * Builds the user prompt describing the trigger context for Gemini.
 */
function buildTriggerPrompt(context: NikkiContextSnapshot, decision: NikkiDecision): string {
  const trigger = decision.trigger;
  const ctx = decision.triggerContext || {};

  switch (trigger) {
    case "timetable_unstarted":
      return `Trigger: Timetable item '${ctx.itemTitle}' was scheduled to start at ${ctx.itemStart} (about ${ctx.minutesSinceStart} minutes ago), but has not been marked started yet. Reach out to ask if they are ready to begin or want to move it.`;

    case "morning_plan":
      return `Trigger: It is morning (${context.localTime}). Greet ${context.userName}, encourage them to hydrate, and gently ask how they want to approach their day.`;

    case "no_timetable":
      return `Trigger: It is daytime (${context.localTime}) and ${context.userName} has no timetable or schedule created for today. Check in and ask if they'd like to map out a quick plan together.`;

    case "mood_followup":
      return `Trigger: Earlier today ${context.userName} felt ${ctx.emotion}. Check in on how they are feeling right now with genuine warmth. Do not diagnose or over-analyze.`;

    case "late_night":
      return `Trigger: It is late at night (${context.localTime}), past their usual bedtime (${ctx.usualBedtime}). They were recently active in the app. Remind them gently to wind down and get some rest.`;

    case "long_session":
      return `Trigger: ${context.userName} has been working in the app continuously for a long session without a break. Suggest taking a moment to stretch, step back, or grab water.`;

    case "task_overdue":
      return `Trigger: The task or goal '${ctx.targetTitle}' is ${ctx.daysOverdue ? `${ctx.daysOverdue} days overdue` : `untouched for ${ctx.daysSinceUpdated} days`}. Ask if they want to tackle a small piece of it or revise it.`;

    case "long_silence":
      return `Trigger: It has been over ${ctx.hoursSinceLastMessage || 24} hours since ${context.userName} last chatted with you. Say a warm hello and ask how their day is going.`;

    default:
      return `Trigger: Friendly check-in with ${context.userName}.`;
  }
}

/**
 * Reliable fallback copy matching persona & strictness if Gemini is unavailable.
 */
function getFallbackMessage(context: NikkiContextSnapshot, decision: NikkiDecision): string {
  const { userName, strictness } = context;
  const trigger = decision.trigger;
  const ctx = decision.triggerContext || {};

  switch (trigger) {
    case "timetable_unstarted": {
      const title = ctx.itemTitle || "your scheduled item";
      if (strictness === "gentle") {
        return `Hey ${userName}, '${title}' was scheduled for a bit ago. Want to ease into it now, or would you like to shift the time?`;
      }
      if (strictness === "firm") {
        return `Hey ${userName}, '${title}' started a little while ago. Are we rolling on this now or shifting the schedule?`;
      }
      return `Hey ${userName}! '${title}' is calling your name. Starting now, or should we shuffle the clock?`;
    }

    case "morning_plan": {
      if (strictness === "gentle") {
        return `Good morning, ${userName}! Grab a glass of water and take a breath — how are you feeling about today?`;
      }
      if (strictness === "firm") {
        return `Morning ${userName}. Let's get hydrated and take a quick look at today's plan, ready?`;
      }
      return `Rise and shine, ${userName}! Have you had a glass of water yet today?`;
    }

    case "no_timetable": {
      if (strictness === "gentle") {
        return `Hey ${userName}, how is your day feeling so far? If you'd like to map out today together, I'm right here.`;
      }
      if (strictness === "firm") {
        return `Good day, ${userName}. No schedule set for today yet — ready to lock in our priorities?`;
      }
      return `Hey ${userName}! Our day is currently a blank canvas — want to sketch a quick plan together?`;
    }

    case "mood_followup": {
      if (strictness === "gentle") {
        return `Hey ${userName}, just wanted to check in on you after earlier. How are you holding up right now?`;
      }
      if (strictness === "firm") {
        return `Hey ${userName}, circling back after earlier. Are you feeling a bit more settled now?`;
      }
      return `Hey ${userName}, sending you a warm little wave! How is the rest of your day treating you?`;
    }

    case "late_night": {
      if (strictness === "gentle") {
        return `Hey ${userName}, it's getting really late. How about we wrap up for tonight and get some rest?`;
      }
      if (strictness === "firm") {
        return `It's past your bedtime, ${userName}. Close up what you're doing and head to sleep, okay?`;
      }
      return `Burning the midnight oil, ${userName}? Don't forget that tomorrow needs your brain rested — ready for bed soon?`;
    }

    case "long_session": {
      if (strictness === "gentle") {
        return `You've been at this for a while, ${userName}. How about stepping away for a glass of water and a quick stretch?`;
      }
      if (strictness === "firm") {
        return `You've had a long continuous session, ${userName}. Step away for five minutes to stretch and hydrate right now.`;
      }
      return `Eyes off the screen for a minute, ${userName}! Time for a quick stretch and water check, what do you say?`;
    }

    case "task_overdue": {
      const title = ctx.targetTitle || "your task";
      if (strictness === "gentle") {
        return `Hey ${userName}, '${title}' is still waiting for us whenever you're ready. Want to knock out a tiny 5-minute piece of it together?`;
      }
      if (strictness === "firm") {
        return `Hey ${userName}, '${title}' is past its due date. Can we clear it today or do we need to revise the deadline?`;
      }
      return `Hey ${userName}! '${title}' is waving from your list. Want to tackle a tiny bite of it today?`;
    }

    case "long_silence": {
      if (strictness === "gentle") {
        return `Hey ${userName}, was just thinking of you. How has your week been treating you?`;
      }
      if (strictness === "firm") {
        return `Hey ${userName}, checking in since it's been a couple of days. How are things tracking?`;
      }
      return `Hey stranger! Just popping in to see how you're doing today — everything going okay?`;
    }

    default:
      return `Hey ${userName}, I'm right here with you! How are things flowing today?`;
  }
}

/**
 * Initiates an in-character message when a trigger fires:
 * 1. Generates speech via Gemini (or persona-aligned fallback)
 * 2. Persists in NikkiNudgeModel (owner-scoped & idempotent)
 * 3. Dispatches via existing notification & push channels
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

  let messageText = "";

  // Attempt Gemini generation if API key is configured
  if (isGeminiConfigured) {
    try {
      const systemInstruction = buildSystemPersonaInstruction(
        context.companionName,
        context.userName,
        context.strictness
      );
      const prompt = buildTriggerPrompt(context, decision);

      const raw = await generateAgentReply(systemInstruction, [], prompt);
      const parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
      if (typeof parsed?.message === "string" && parsed.message.trim().length > 0) {
        messageText = parsed.message.trim();
      }
    } catch (err) {
      console.warn("[Companion Nikki Speak] Gemini generation failed; using fallback:", err);
    }
  }

  if (!messageText) {
    messageText = getFallbackMessage(context, decision);
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
      actionUrl: "/dashboard",
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

