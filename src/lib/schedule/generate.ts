import { buildAgentContext } from "@/lib/ai/context";
import { generateAgentReply } from "@/lib/ai/gemini";
import { buildSchedulePromptInstruction } from "./prompts";
import { validateAndRepairSchedule } from "./validate";
import { saveSchedule } from "@/services/scheduleService";
import { isDateToday, getTodayDateStr, getTomorrowDateStr } from "@/lib/time/currentTime";
import type { ScheduleSummary } from "@/types/schedule";
import type { ChatTurn } from "@/lib/ai/types";

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

const DATE_REGEX = /\b(\d{4}-\d{2}-\d{2})\b/;

/**
 * Resolves the target calendar date from the user's message and current timezone.
 * Defaults to today for general requests ("plan my day", "timetable"),
 * and resolves to tomorrow when "tomorrow" is mentioned.
 */
export function resolveTargetDate(userMessage: string, timezone: string, history?: ChatTurn[]): string {
  const lower = userMessage.toLowerCase();

  // Explicit YYYY-MM-DD match in current message
  const explicitMatch = lower.match(DATE_REGEX);
  if (explicitMatch) {
    return explicitMatch[1];
  }

  const todayStr = getTodayDateStr(timezone);
  const tomorrowStr = getTomorrowDateStr(timezone);

  if (lower.includes("tomorrow")) {
    return tomorrowStr;
  }

  // If user says "save it" / "looks good" / "confirm", inspect recent conversation history for target date
  if (history && history.length > 0) {
    for (let i = history.length - 1; i >= Math.max(0, history.length - 4); i--) {
      const turnText = history[i].text.toLowerCase();
      const histDateMatch = turnText.match(DATE_REGEX);
      if (histDateMatch) return histDateMatch[1];
      if (turnText.includes("tomorrow")) return tomorrowStr;
    }
  }

  // If "today", "tonight", "this afternoon", "this evening", "now", or general planning
  return todayStr;
}

/**
 * The scheduling orchestration layer:
 * Builds context with authoritative time and recent conversation constraints,
 * generates a structured proposal with Gemini, validates mathematically
 * and against current time, and persists to MongoDB.
 */
export async function generateAndPersistSchedule(
  firebaseUid: string,
  userMessage: string,
  history: ChatTurn[] = [],
  clientTimezone?: string | null
): Promise<ScheduleSummary> {
  const context = await buildAgentContext(firebaseUid, clientTimezone);
  const targetDate = resolveTargetDate(userMessage, context.currentTimeInfo.timezone);
  const isToday = isDateToday(targetDate, context.currentTimeInfo.timezone);

  // Extract recent conversation constraints so Gemini sees commitments discussed
  const recentTurns = history.slice(-8);
  const conversationNotes = recentTurns.length > 0
    ? recentTurns.map((t) => `${t.role === "user" ? "User" : "Nikki"}: ${t.text}`).join("\n")
    : "";

  const instruction = buildSchedulePromptInstruction(context, targetDate, isToday, conversationNotes);

  const rawText = await generateAgentReply(instruction, recentTurns, userMessage);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(rawText));
  } catch (error) {
    throw new Error(`Schedule response wasn't valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const rawItems = (parsed as { items?: unknown })?.items;
  const ownedTaskIds = new Set(context.activeTasks.map((t) => t.id));

  const items = validateAndRepairSchedule(rawItems, ownedTaskIds, {
    isToday,
    currentTime: context.currentTimeInfo.timeStr,
  });

  return saveSchedule(firebaseUid, targetDate, items);
}
