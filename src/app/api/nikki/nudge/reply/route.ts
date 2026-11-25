import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { NikkiNudgeModel } from "@/models/NikkiNudge";
import { UserModel } from "@/models/User";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";
import { updatePreferences } from "@/services/notificationService";
import { runAgent } from "@/lib/ai/agent";
import {
  isStopRequest,
  getBackOffResponse,
  detectOverdueTaskAnswer,
  getOverdueTaskReaction,
} from "@/lib/nikki/persona";
import {
  parseAccountabilityIntent,
  executeAccountabilityAction,
  generateDefaultSubSteps,
} from "@/lib/nikki/accountabilitySupport";
import {
  getOrCreateActiveConversation,
  saveMessage,
  loadRecentHistory,
  saveEmotionObservation,
  updateConversationTitle,
} from "@/services/conversationService";
import { processMemoryCandidates } from "@/services/memoryService";
import { deriveTitleFromMessage } from "@/lib/conversation/titles";
import { generateAndPersistSchedule, resolveTargetDate } from "@/lib/schedule/generate";
import { deleteSchedule, getSchedule } from "@/services/scheduleService";
import { handleReminderAction } from "@/services/timetableReminderService";
import type { ScheduleSummary } from "@/types/schedule";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const nudgeId = typeof body.nudgeId === "string" ? body.nudgeId : undefined;
    const clientTimezone = typeof body.timezone === "string" ? body.timezone : undefined;

    if (!message) {
      return NextResponse.json(
        { error: { message: "Message is required.", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    await connectToDatabase();

    let nudgeDoc = null;
    if (nudgeId) {
      nudgeDoc = await NikkiNudgeModel.findOne({ _id: nudgeId, firebaseUid: user.uid });
    }

    // Determine target conversation
    let conversationId: string;
    const existingThreadId = nudgeDoc?.metadata?.conversationId;

    if (existingThreadId && typeof existingThreadId === "string") {
      conversationId = existingThreadId;
    } else if (nudgeDoc) {
      // Start a dedicated thread with the nudge as the first message
      const { conversation } = await getOrCreateActiveConversation(user.uid, null, true);
      conversationId = String(conversation._id);

      // Save the nudge as the first assistant message in this thread
      await saveMessage({
        conversationId,
        firebaseUid: user.uid,
        role: "assistant",
        content: nudgeDoc.message,
      });

      const title = deriveTitleFromMessage(nudgeDoc.message) || "Nikki Check-in";
      await updateConversationTitle(conversationId, title).catch(() => {});
    } else {
      const { conversation } = await getOrCreateActiveConversation(user.uid);
      conversationId = String(conversation._id);
    }

    // Save user's message
    const userMessageDoc = await saveMessage({
      conversationId,
      firebaseUid: user.uid,
      role: "user",
      content: message,
    });

    // Load user & preferences for persona styling
    const [userDoc, prefsDoc] = await Promise.all([
      UserModel.findOne({ firebaseUid: user.uid }).select("displayName"),
      NotificationPreferenceModel.findOne({ firebaseUid: user.uid }).select("strictness"),
    ]);
    const userName = userDoc?.displayName || "friend";
    const strictness = prefsDoc?.strictness || nudgeDoc?.strictness || "playful";

    // ── Persona Rule: Back off if user says stop ──────────────────────────────
    if (isStopRequest(message)) {
      // Pause proactive communication for 24 hours
      const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await updatePreferences(user.uid, { pausedUntil: pauseUntil }).catch(() => {});

      const backOffReply = getBackOffResponse(userName, strictness);
      await saveMessage({
        conversationId,
        firebaseUid: user.uid,
        role: "assistant",
        content: backOffReply,
      });

      if (nudgeDoc) {
        nudgeDoc.status = "dismissed";
        await nudgeDoc.save().catch(() => {});
      }

      return NextResponse.json({
        data: {
          reply: backOffReply,
          conversationId,
          intent: "conversation",
          pose: "concerned",
        },
      });
    }

    // ── NIKKI PART 4D: Interactive Goal & Task Accountability Support ────────
    const targetId =
      (nudgeDoc?.metadata?.targetId as string) ||
      (nudgeDoc?.metadata?.taskId as string) ||
      (nudgeDoc?.metadata?.goalId as string) ||
      undefined;

    const targetTitle =
      (nudgeDoc?.metadata?.targetTitle as string) ||
      (nudgeDoc?.metadata?.taskTitle as string) ||
      (nudgeDoc?.metadata?.goalTitle as string) ||
      (nudgeDoc?.metadata?.itemTitle as string) ||
      undefined;

    const targetType: "task" | "goal" =
      (nudgeDoc?.metadata?.targetType as "task" | "goal") ||
      (nudgeDoc?.trigger === "goal_neglected" ? "goal" : "task");

    const accountabilityAnalysis = parseAccountabilityIntent(message, {
      targetId,
      targetTitle,
      targetType,
      userName,
      strictness,
    });

    if (accountabilityAnalysis.intent !== "general") {
      let actionExecuted = false;
      let contextUpdated = false;
      let updatedContextSummary: Record<string, unknown> | undefined;

      // Handle database execution ONLY after explicit user confirmation
      if (accountabilityAnalysis.shouldModifyDatabase && targetId) {
        try {
          if (accountabilityAnalysis.intent === "confirm_action") {
            const pending = nudgeDoc?.metadata?.pendingAction as
              | { action: string; targetType?: "task" | "goal"; payload?: Record<string, unknown> }
              | undefined;

            if (pending?.action) {
              const execRes = await executeAccountabilityAction({
                action: pending.action,
                firebaseUid: user.uid,
                targetId,
                targetType: pending.targetType || targetType,
                payload: pending.payload || { title: targetTitle },
              });
              actionExecuted = Boolean(execRes?.ok);
            } else if (Array.isArray(nudgeDoc?.metadata?.proposedSteps)) {
              const execRes = await executeAccountabilityAction({
                action: "break_task",
                firebaseUid: user.uid,
                targetId,
                targetType,
                payload: { steps: nudgeDoc.metadata.proposedSteps, title: targetTitle },
              });
              actionExecuted = Boolean(execRes?.ok);
            }
          } else if (accountabilityAnalysis.actionToExecute) {
            const execRes = await executeAccountabilityAction({
              action: accountabilityAnalysis.actionToExecute,
              firebaseUid: user.uid,
              targetId,
              targetType,
              payload: {
                dueDate: accountabilityAnalysis.newDueDate,
                newDeadline: accountabilityAnalysis.newDueDate,
                priority: accountabilityAnalysis.newPriority,
                title: targetTitle,
              },
            });
            actionExecuted = Boolean(execRes?.ok);
          }

          // Refresh Nikki's context after database changes so her awareness stays current
          if (actionExecuted) {
            const { buildNikkiContext } = await import("@/lib/nikki/context");
            const refreshed = await buildNikkiContext(user.uid, clientTimezone);
            contextUpdated = true;
            updatedContextSummary = {
              pendingTasksCount: refreshed.totalPendingTasksCount,
              completedTasksCountToday: refreshed.completedTasksCountToday,
              neglectedGoalsCount: refreshed.neglectedGoals.length,
              activeGoalsCount: refreshed.activeGoals.length,
            };
          }
        } catch (actErr) {
          console.warn("[Companion Accountability Action] Execution error:", actErr);
        }
      }

      const replyContent =
        accountabilityAnalysis.replyMessage ||
        `I'm right here with you! Let's take '${targetTitle || "this"}' one step at a time.`;

      await saveMessage({
        conversationId,
        firebaseUid: user.uid,
        role: "assistant",
        content: replyContent,
      });

      if (nudgeDoc) {
        nudgeDoc.status = "replied";
        nudgeDoc.metadata = {
          ...(nudgeDoc.metadata || {}),
          conversationId,
          proposedSteps: accountabilityAnalysis.proposedSteps || nudgeDoc.metadata?.proposedSteps,
          pendingAction: actionExecuted
            ? null
            : accountabilityAnalysis.pendingAction ?? nudgeDoc.metadata?.pendingAction,
        };
        await nudgeDoc.save().catch(() => {});
      }

      return NextResponse.json({
        data: {
          reply: replyContent,
          conversationId,
          intent: accountabilityAnalysis.intent,
          pose: accountabilityAnalysis.pose,
          goalTaskChanged: actionExecuted,
          requiresConfirmation: Boolean(accountabilityAnalysis.requiresConfirmation),
          contextUpdated,
          updatedContextSummary,
        },
      });
    }

    // ── Persona Scenario (3): Overdue or late task reaction ───────────────────
    if (nudgeDoc?.trigger === "task_overdue" || nudgeDoc?.trigger === "timetable_unstarted") {
      const answerType = detectOverdueTaskAnswer(message);
      if (answerType !== "other") {
        const targetTitle =
          (nudgeDoc.metadata?.targetTitle as string) ||
          (nudgeDoc.metadata?.itemTitle as string) ||
          "your task";

        // Handle timetable actions if applicable
        if (nudgeDoc.trigger === "timetable_unstarted") {
          const uniqueKey = nudgeDoc.idempotencyKey.replace(/^.*:timetable_unstarted:/, "");
          if (answerType === "now") {
            await handleReminderAction({ uniqueKey, action: "start", firebaseUid: user.uid }).catch(() => {});
          } else if (answerType === "later") {
            await handleReminderAction({ uniqueKey, action: "later", firebaseUid: user.uid }).catch(() => {});
          }
        }

        const reaction = getOverdueTaskReaction(answerType, targetTitle, userName, strictness);
        const taskPose = answerType === "now" ? "celebrate" : answerType === "later" ? "think" : "concerned";

        await saveMessage({
          conversationId,
          firebaseUid: user.uid,
          role: "assistant",
          content: reaction,
        });

        if (nudgeDoc) {
          nudgeDoc.status = "replied";
          nudgeDoc.metadata = { ...(nudgeDoc.metadata || {}), conversationId };
          await nudgeDoc.save().catch(() => {});
        }

        return NextResponse.json({
          data: {
            reply: reaction,
            conversationId,
            intent: "task_reaction",
            pose: taskPose,
          },
        });
      }
    }

    // Special trigger action handlers for timetable_unstarted
    if (nudgeDoc?.trigger === "timetable_unstarted") {
      const lower = message.toLowerCase();
      const uniqueKey = nudgeDoc.idempotencyKey.replace(/^.*:timetable_unstarted:/, "");

      if (lower.includes("start") || lower.includes("begin") || lower.includes("now") || lower.includes("on it")) {
        await handleReminderAction({ uniqueKey, action: "start", firebaseUid: user.uid }).catch(() => {});
      } else if (lower.includes("skip")) {
        await handleReminderAction({ uniqueKey, action: "skip", firebaseUid: user.uid }).catch(() => {});
      } else if (lower.includes("later") || lower.includes("move") || lower.includes("delay")) {
        await handleReminderAction({ uniqueKey, action: "later", firebaseUid: user.uid }).catch(() => {});
      }
    }

    // Load recent history (includes the nudge as assistant message!)
    const recentHistory = await loadRecentHistory(conversationId, String(userMessageDoc._id));

    // Run agent
    const agentResponse = await runAgent(user.uid, message, recentHistory, clientTimezone);

    // Timetable / schedule action execution
    let schedule: ScheduleSummary | null = null;
    if (agentResponse.intent === "timetable_delete") {
      try {
        const targetDate = resolveTargetDate(message, clientTimezone ?? "UTC", recentHistory);
        await deleteSchedule(user.uid, targetDate);
      } catch (e) {
        console.error("[Nudge Reply] Timetable delete error:", e);
      }
    } else if (
      agentResponse.intent === "timetable_request" ||
      agentResponse.intent === "reschedule_request" ||
      (agentResponse.intent === "planning" && /\b(timetable|schedule)\b/i.test(message))
    ) {
      try {
        schedule = await generateAndPersistSchedule(user.uid, message, recentHistory, clientTimezone);
      } catch (e) {
        console.error("[Nudge Reply] Schedule generation error:", e);
      }
    } else if (agentResponse.intent === "timetable_save") {
      try {
        const targetDate = resolveTargetDate(message, clientTimezone ?? "UTC", recentHistory);
        const existing = await getSchedule(user.uid, targetDate);
        schedule = existing || (await generateAndPersistSchedule(user.uid, message, recentHistory, clientTimezone));
      } catch (e) {
        console.error("[Nudge Reply] Timetable save error:", e);
      }
    }

    // Save assistant reply
    await saveMessage({
      conversationId,
      firebaseUid: user.uid,
      role: "assistant",
      content: agentResponse.message,
      scheduleId: schedule?.id ?? null,
      scheduleDate: schedule?.date ?? null,
      scheduleSnapshot: schedule ?? null,
    });

    // Save emotion & memories (best-effort)
    saveEmotionObservation({
      firebaseUid: user.uid,
      conversationId,
      sourceMessageId: String(userMessageDoc._id),
      emotion: agentResponse.emotion.emotion,
      intensity: agentResponse.emotion.intensity,
      confidence: agentResponse.emotion.confidence,
      secondaryEmotion: agentResponse.emotion.secondaryEmotion,
    }).catch(() => {});

    if (agentResponse.memoryCandidates.length > 0) {
      processMemoryCandidates({
        firebaseUid: user.uid,
        conversationId,
        sourceMessageId: String(userMessageDoc._id),
        candidates: agentResponse.memoryCandidates,
      }).catch(() => {});
    }

    // Mark nudge as replied
    if (nudgeDoc) {
      nudgeDoc.status = "replied";
      nudgeDoc.metadata = {
        ...(nudgeDoc.metadata || {}),
        conversationId,
      };
      await nudgeDoc.save();
    }

    // Determine expressive pose
    const derivedPose = (() => {
      const lower = message.toLowerCase();
      if (agentResponse.intent === "farewell") return "wave";
      if (agentResponse.intent === "welcome_back") return "happy";
      if (schedule || agentResponse.intent === "timetable_save") return "celebrate";
      const em = agentResponse.emotion?.emotion;
      if (em === "happy" || em === "excited") return "celebrate";
      if (em === "sad" || em === "anxious" || em === "overwhelmed") return "concerned";
      if (em === "frustrated" || em === "stressed") return "think";
      if (em === "calm" || em === "neutral") return "curious";
      if (/sleep|bed\b|rest\b|tired/i.test(lower)) return "sleepy";
      return "happy";
    })();

    const goalTaskChanged =
      (agentResponse.intent as string) === "task_complete" ||
      (agentResponse.intent as string) === "goal_update" ||
      (agentResponse.intent as string) === "task_reschedule" ||
      (agentResponse.intent as string) === "task_break";

    return NextResponse.json({
      data: {
        reply: agentResponse.message,
        conversationId,
        intent: agentResponse.intent,
        schedule,
        pose: derivedPose,
        goalTaskChanged: goalTaskChanged || false,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error("[Companion Nudge Reply] Error:", error);
    return NextResponse.json(
      { error: { message: "Failed to process reply.", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
