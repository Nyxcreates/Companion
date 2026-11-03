import type { AgentContext } from "@/lib/ai/types";

/**
 * A separate, narrowly-scoped system instruction used ONLY for the
 * second, structured-schedule Gemini call triggered after a
 * timetable_request/reschedule_request intent.
 */
export function buildSchedulePromptInstruction(
  context: AgentContext,
  targetDate: string,
  isToday: boolean,
  conversationNotes: string = ""
): string {
  const taskLines =
    context.activeTasks.length > 0
      ? context.activeTasks
          .map(
            (t) =>
              `- id="${t.id}": "${t.title}"${t.goalTitle ? ` (goal: ${t.goalTitle})` : ""}${
                t.dueDate ? `, due ${t.dueDate.slice(0, 10)}` : ""
              }`
          )
          .join("\n")
      : "(no pending tasks)";

  const memoryLines =
    context.relevantMemories.length > 0 ? context.relevantMemories.map((m) => `- ${m.content}`).join("\n") : "(none)";

  const rhythmLine =
    context.dailyRhythm.wakeTime || context.dailyRhythm.sleepTime || context.dailyRhythm.focusPeriods.length > 0
      ? `Wakes around ${context.dailyRhythm.wakeTime ?? "unknown"}, winds down around ${
          context.dailyRhythm.sleepTime ?? "unknown"
        }. Focuses best during: ${context.dailyRhythm.focusPeriods.join(", ") || "unspecified"}.`
      : "No known daily rhythm.";

  const todayRule = isToday
    ? `CRITICAL TIME CONSTRAINTS FOR TODAY (${targetDate}):
- Current local time is ${context.currentTimeInfo.timeStr} (${context.currentTimeInfo.timeStr12}) [${context.currentTimeInfo.timezone}].
- NEVER schedule any activity before ${context.currentTimeInfo.timeStr}! The morning and earlier parts of today are in the past.
- ALL proposed schedule blocks MUST start at or after ${context.currentTimeInfo.timeStr}.`
    : `Planning for date: ${targetDate} (not today). You may schedule activities starting from their normal waking hours (${context.dailyRhythm.wakeTime ?? "08:00"}).`;

  return `
You are generating a structured, time-divided daily schedule for one specific date. Output ONLY the JSON schedule described below, nothing else.

Current runtime info:
- Authoritative date/time: ${context.currentTimeInfo.formatted}
- Current local time: ${context.currentTimeInfo.timeStr}
- Target date to schedule: ${targetDate}

${todayRule}

Constraints & Context discussed in recent conversation:
${conversationNotes ? conversationNotes : "(none specified in chat)"}

The user's pending tasks (use the exact "id" value verbatim as "taskId" when a block is for one of these — never invent a task id, never use one not in this list):
${taskLines}

Relevant user context and planning preferences:
${memoryLines}

Daily rhythm:
${rhythmLine}

Rules:
- Respect fixed commitments! If the user mentioned visiting relatives, attending classes, a meeting, or unavailable hours, mark those blocks as type "commitment" and DO NOT schedule other activities during those hours.
- If the user corrected a commitment in conversation (e.g. changed start/end time), use the latest corrected time.
- If the target date is today, NEVER schedule anything earlier than ${context.currentTimeInfo.timeStr}.
- Use 24-hour "HH:MM" format for "start" and "end". "end" must be strictly after "start".
- Produce between 2 and 12 realistic blocks. Include reasonable breaks ("break") or meals.
- Prefer scheduling actual pending tasks from the list above where sensible. Not every task needs scheduling; do not overload an already full evening or day.

Output ONLY this JSON shape, no markdown fences, no other text:
{
  "items": [
    { "start": "HH:MM", "end": "HH:MM", "title": string, "type": "task" | "break" | "commitment" | "free", "taskId": string | null }
  ]
}
`.trim();
}
