import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { NikkiNudgeModel } from "@/models/NikkiNudge";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";
import { UserModel } from "@/models/User";
import { getOrCreateActiveConversation, saveMessage, updateConversationTitle } from "@/services/conversationService";
import { handleReminderAction } from "@/services/timetableReminderService";
import { TimetableReminderModel } from "@/models/TimetableReminder";
import { computeSnoozeUntil } from "@/lib/nikki/reminderPolicy";
import { generateAgentReply, isGeminiConfigured } from "@/lib/ai/gemini";
import {
  classifyTriggerCategory,
  getContextualOpeningFallback,
  type ReminderCategoryKind,
} from "@/lib/nikki/persona";
import { resolveUserTimezone } from "@/lib/time/currentTime";

export const runtime = "nodejs";

type ReminderActionType = "talk" | "snooze" | "acknowledge" | "start" | "done" | "skip" | "dismiss";

function getLocalDateStr(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function deriveConversationTitle(category: ReminderCategoryKind, contextNote?: string): string {
  switch (category) {
    case "sleep":
      return "Late Night Check-in";
    case "study":
      return contextNote ? `Study: ${contextNote.slice(0, 36)}` : "Study Session";
    case "hobby":
      return contextNote ? `Hobby: ${contextNote.slice(0, 36)}` : "Hobby & Personal Time";
    case "upcoming":
      return contextNote ? `Prep: ${contextNote.slice(0, 36)}` : "Upcoming Activity";
    case "checkin":
    default:
      return "Nikki Check-in";
  }
}

async function generateContextualOpening(params: {
  category: ReminderCategoryKind;
  userName: string;
  companionName: string;
  reminderMessage?: string;
  contextNote?: string;
}): Promise<string> {
  const fallback = getContextualOpeningFallback(params.category, params.contextNote);
  if (!isGeminiConfigured) {
    return fallback;
  }

  try {
    const systemPrompt = `You are ${params.companionName}, a warm, caring, natural companion talking to ${params.userName}.
Generate a single short, natural opening message (1-2 sentences) to start a new conversation after ${params.userName} clicked "Talk to Nikki" on a ${params.category} reminder.
Do NOT be robotic or mention system prompts. Sound like a real caring friend.`;

    const userPrompt = `Reminder category: ${params.category}
Reminder shown: "${params.reminderMessage || ""}"
Context item: "${params.contextNote || "none"}"
Example tone: "${fallback}"
Write a natural, warm opening message for this new conversation.`;

    const raw = await generateAgentReply(systemPrompt, [], userPrompt);
    const cleaned = raw.trim().replace(/^["']|["']$/g, "");
    if (cleaned.length >= 10 && cleaned.length <= 360) {
      return cleaned;
    }
  } catch (err) {
    console.warn("[Companion Nudge Action] Gemini opening generation failed, using fallback:", err);
  }

  return fallback;
}

/**
 * POST /api/nikki/nudge/action
 *
 * Handles Floating Nikki contextual actions:
 *  - talk: creates a NEW conversation with a context-aware opening from Nikki
 *  - snooze: persists snooze (sleepSnoozeUntil or nudge.snoozedUntil)
 *  - acknowledge: marks reminder done/acknowledged & cancels pending sleep snooze
 *  - dismiss: dismisses reminder & cancels pending sleep snooze
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));

    const action = body.action as ReminderActionType | undefined;
    if (!action || !["talk", "snooze", "acknowledge", "start", "done", "skip", "dismiss"].includes(action)) {
      return NextResponse.json(
        { error: { message: "Valid action (talk, snooze, acknowledge, start, done, skip, dismiss) is required.", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    const nudgeId = typeof body.nudgeId === "string" && body.nudgeId.trim() ? body.nudgeId.trim() : undefined;
    const rawTrigger = typeof body.trigger === "string" ? body.trigger : undefined;
    const rawMessage = typeof body.message === "string" ? body.message : undefined;
    const rawMetadata = (body.metadata && typeof body.metadata === "object" ? body.metadata : {}) as Record<string, unknown>;
    const clientTimezone = typeof body.timezone === "string" ? body.timezone : undefined;

    await connectToDatabase();

    const [nudgeDoc, prefsDoc, userDoc] = await Promise.all([
      nudgeId ? NikkiNudgeModel.findOne({ _id: nudgeId, firebaseUid: user.uid }) : null,
      NotificationPreferenceModel.findOne({ firebaseUid: user.uid }),
      UserModel.findOne({ firebaseUid: user.uid }).select("displayName companionName timezone"),
    ]);

    const trigger = nudgeDoc?.trigger || rawTrigger || "general_checkin";
    const category = classifyTriggerCategory(trigger);
    const timezone = resolveUserTimezone(clientTimezone, userDoc?.timezone);
    const localDate = getLocalDateStr(timezone);

    // ── 1. SNOOZE ─────────────────────────────────────────────────────────────
    if (action === "snooze") {
      const requestedMins = typeof body.minutes === "number" ? body.minutes : undefined;
      const defaultMins = category === "sleep" ? (prefsDoc?.sleepReminderSnoozeMinutes ?? 25) : 15;
      const snoozeMinutes = Math.max(5, Math.min(120, Math.round(requestedMins ?? defaultMins)));
      const snoozedUntil = computeSnoozeUntil(Date.now(), snoozeMinutes);

      if (category === "sleep") {
        await NotificationPreferenceModel.findOneAndUpdate(
          { firebaseUid: user.uid },
          { $set: { sleepSnoozeUntil: snoozedUntil, sleepDismissedForDate: null } },
          { upsert: true }
        );
        if (nudgeDoc) {
          nudgeDoc.status = "dismissed";
          await nudgeDoc.save();
        }
      } else {
        if (nudgeDoc) {
          nudgeDoc.status = "snoozed";
          nudgeDoc.snoozedUntil = snoozedUntil;
          await nudgeDoc.save();
        }
        const meta = (nudgeDoc?.metadata || rawMetadata || {}) as Record<string, unknown>;
        const uniqueKey = typeof meta.uniqueKey === "string" ? meta.uniqueKey : undefined;
        if (uniqueKey) {
          await TimetableReminderModel.updateOne(
            { firebaseUid: user.uid, uniqueKey },
            { $set: { status: "later", nudgeAt: snoozedUntil } }
          ).catch(() => {});
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          action: "snooze",
          category,
          snoozeMinutes,
          snoozedUntil: snoozedUntil.toISOString(),
        },
      });
    }

    // ── 2. ACKNOWLEDGE / START / DONE / SKIP / DISMISS ────────────────────────
    if (
      action === "acknowledge" ||
      action === "start" ||
      action === "done" ||
      action === "skip" ||
      action === "dismiss"
    ) {
      if (category === "sleep") {
        await NotificationPreferenceModel.findOneAndUpdate(
          { firebaseUid: user.uid },
          { $set: { sleepSnoozeUntil: null, sleepDismissedForDate: localDate } },
          { upsert: true }
        );
      }

      const isCompleted = action === "acknowledge" || action === "start" || action === "done";
      if (nudgeDoc) {
        nudgeDoc.status = isCompleted ? "done" : "dismissed";
        nudgeDoc.snoozedUntil = null;
        if (isCompleted) {
          nudgeDoc.completedAt = new Date();
        }
        await nudgeDoc.save();
      }

      const meta = (nudgeDoc?.metadata || rawMetadata || {}) as Record<string, unknown>;
      const uniqueKey =
        (typeof meta.uniqueKey === "string" && meta.uniqueKey) ||
        (nudgeDoc?.trigger === "timetable_unstarted"
          ? nudgeDoc.idempotencyKey
              .replace(/^.*:timetable_unstarted:\d{4}-\d{2}-\d{2}:/, "")
              .replace(/:r\d+$/, "")
          : undefined);

      if (uniqueKey && (trigger === "timetable_unstarted" || typeof meta.uniqueKey === "string")) {
        const timetableAction =
          action === "done"
            ? "done"
            : action === "skip" || action === "dismiss"
              ? "skip"
              : "start";

        const res = await handleReminderAction({
          uniqueKey,
          action: timetableAction,
          firebaseUid: user.uid,
        }).catch(() => ({ success: false }));

        // If no TimetableReminder document existed yet, upsert one so state is persisted server-side
        if (!res?.success && typeof meta.scheduleId === "string" && typeof meta.itemIndex === "number") {
          const targetStatus =
            timetableAction === "done"
              ? "done"
              : timetableAction === "skip"
                ? "skipped"
                : "started";
          await TimetableReminderModel.findOneAndUpdate(
            { uniqueKey },
            {
              $set: {
                firebaseUid: user.uid,
                scheduleId: meta.scheduleId,
                scheduleDate: localDate,
                itemIndex: meta.itemIndex,
                itemTitle: (meta.itemTitle as string) || "Scheduled task",
                itemStart: (meta.itemStart as string) || "00:00",
                itemEnd: (meta.itemEnd as string) || "00:00",
                itemType: "task",
                status: targetStatus,
                nudgeAt: null,
              },
            },
            { upsert: true }
          ).catch(() => {});
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          action,
          category,
          status: isCompleted ? "done" : "dismissed",
        },
      });
    }

    // ── 3. TALK TO NIKKI (New Conversation) ───────────────────────────────────
    if (category === "sleep") {
      await NotificationPreferenceModel.findOneAndUpdate(
        { firebaseUid: user.uid },
        { $set: { sleepSnoozeUntil: null } },
        { upsert: true }
      );
    }

    const { conversation } = await getOrCreateActiveConversation(user.uid, null, true);
    const conversationId = String(conversation._id);

    const meta = (nudgeDoc?.metadata || rawMetadata || {}) as Record<string, unknown>;
    const contextNote =
      (meta.itemTitle as string) ||
      (meta.taskTitle as string) ||
      (meta.targetTitle as string) ||
      (meta.hobbyTitle as string) ||
      (meta.activityTitle as string) ||
      undefined;

    const openingMessage = await generateContextualOpening({
      category,
      userName: userDoc?.displayName?.trim() || "friend",
      companionName: userDoc?.companionName?.trim() || "Nikki",
      reminderMessage: nudgeDoc?.message || rawMessage,
      contextNote,
    });

    await saveMessage({
      conversationId,
      firebaseUid: user.uid,
      role: "assistant",
      content: openingMessage,
    });

    const title = deriveConversationTitle(category, contextNote);
    await updateConversationTitle(conversationId, title).catch(() => {});

    if (nudgeDoc) {
      nudgeDoc.status = "replied";
      nudgeDoc.snoozedUntil = null;
      nudgeDoc.metadata = {
        ...(nudgeDoc.metadata || {}),
        conversationId,
      };
      await nudgeDoc.save();
    }

    return NextResponse.json({
      success: true,
      data: {
        action: "talk",
        category,
        conversationId,
        openingMessage,
        title,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Nudge Action] Error:", error);
    return NextResponse.json(
      { error: { message: "Failed to process reminder action.", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
