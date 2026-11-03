import type { ScheduleItem, ScheduleItemType } from "@/types/schedule";
import { InvalidScheduleError } from "./errors";
import { timeStringToMinutes, minutesToTimeString } from "@/lib/time/currentTime";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VALID_TYPES: ScheduleItemType[] = ["task", "break", "commitment", "free"];
const MAX_ITEMS = 24;
const MIN_BLOCK_MINUTES = 5;

interface RawItem {
  start?: unknown;
  end?: unknown;
  title?: unknown;
  type?: unknown;
  taskId?: unknown;
}

export interface ScheduleValidationOptions {
  isToday?: boolean;
  currentTime?: string; // HH:mm
}

/**
 * Deterministically validates and safely repairs a raw schedule proposal.
 *
 * Rules:
 * 1. LLM proposes; application code guarantees mathematical/time correctness.
 * 2. If the target date is today, never allow activities in the past.
 * 3. Fixed commitments (type: "commitment") must not be pushed or shifted by flexible tasks.
 * 4. No overlapping blocks.
 * 5. Owned task IDs are verified server-side; invalid task IDs become plain blocks.
 */
export function validateAndRepairSchedule(
  raw: unknown,
  ownedTaskIds: Set<string>,
  options: ScheduleValidationOptions = {}
): ScheduleItem[] {
  if (!Array.isArray(raw)) {
    throw new InvalidScheduleError("the response wasn't a list of schedule blocks.");
  }
  if (raw.length === 0) {
    throw new InvalidScheduleError("no schedule blocks were proposed.");
  }
  if (raw.length > MAX_ITEMS) {
    throw new InvalidScheduleError("too many blocks were proposed for one day.");
  }

  const currentMinutes = options.currentTime && TIME_RE.test(options.currentTime)
    ? timeStringToMinutes(options.currentTime)
    : null;

  const parsedItems: ScheduleItem[] = [];

  for (const entry of raw as RawItem[]) {
    if (typeof entry !== "object" || entry === null) continue;

    const start = typeof entry.start === "string" ? entry.start.trim() : "";
    const end = typeof entry.end === "string" ? entry.end.trim() : "";
    const title = typeof entry.title === "string" ? entry.title.trim().slice(0, 100) : "";
    const rawType =
      typeof entry.type === "string" && VALID_TYPES.includes(entry.type as ScheduleItemType)
        ? (entry.type as ScheduleItemType)
        : "free";

    if (!TIME_RE.test(start) || !TIME_RE.test(end)) continue;
    if (title.length === 0) continue;
    if (timeStringToMinutes(end) <= timeStringToMinutes(start)) continue;

    const rawTaskId = typeof entry.taskId === "string" ? entry.taskId : null;
    const taskId = rawTaskId && ownedTaskIds.has(rawTaskId) ? rawTaskId : null;

    parsedItems.push({
      start,
      end,
      title,
      type: rawType === "commitment" ? "commitment" : taskId ? "task" : rawType,
      taskId,
    });
  }

  if (parsedItems.length === 0) {
    throw new InvalidScheduleError("none of the proposed blocks were valid.");
  }

  // 1. If scheduling for today, eliminate activities that have already completed in the past.
  //    For activities currently in progress, clip the start time to current time.
  const timeFiltered: ScheduleItem[] = [];
  for (const item of parsedItems) {
    let startMin = timeStringToMinutes(item.start);
    const endMin = timeStringToMinutes(item.end);

    if (options.isToday && currentMinutes !== null) {
      if (endMin <= currentMinutes) {
        // Completely in the past for today's plan — drop it.
        continue;
      }
      if (startMin < currentMinutes) {
        // Clip start time forward to current time
        startMin = currentMinutes;
      }
      if (endMin - startMin < MIN_BLOCK_MINUTES) {
        // Squeezed below minimum duration
        continue;
      }
    }

    timeFiltered.push({
      ...item,
      start: minutesToTimeString(startMin),
      end: minutesToTimeString(endMin),
    });
  }

  if (timeFiltered.length === 0) {
    throw new InvalidScheduleError(
      options.isToday
        ? "all proposed activities are already in the past for today."
        : "no proposed activities were valid."
    );
  }

  // 2. Separate fixed commitments from flexible items
  const commitments: ScheduleItem[] = [];
  const flexibleItems: ScheduleItem[] = [];

  for (const item of timeFiltered) {
    if (item.type === "commitment") {
      commitments.push(item);
    } else {
      flexibleItems.push(item);
    }
  }

  // Sort commitments chronologically and repair any mutual overlaps among commitments
  commitments.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));
  const cleanCommitments: ScheduleItem[] = [];
  let commitmentCursor = options.isToday && currentMinutes !== null ? currentMinutes : 0;

  for (const c of commitments) {
    let cStart = timeStringToMinutes(c.start);
    const cEnd = timeStringToMinutes(c.end);
    if (cStart < commitmentCursor) cStart = commitmentCursor;
    if (cEnd - cStart >= MIN_BLOCK_MINUTES) {
      cleanCommitments.push({ ...c, start: minutesToTimeString(cStart), end: minutesToTimeString(cEnd) });
      commitmentCursor = cEnd;
    }
  }

  // 3. Place flexible items around commitments without shifting commitments
  flexibleItems.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));

  const allScheduled: ScheduleItem[] = [...cleanCommitments];

  for (const flex of flexibleItems) {
    let flexStart = timeStringToMinutes(flex.start);
    let flexEnd = timeStringToMinutes(flex.end);
    const flexDuration = flexEnd - flexStart;

    // Check overlap against every placed commitment
    for (const com of cleanCommitments) {
      const comStart = timeStringToMinutes(com.start);
      const comEnd = timeStringToMinutes(com.end);

      // Does flex overlap com?
      if (flexStart < comEnd && flexEnd > comStart) {
        if (flexStart < comStart && comStart - flexStart >= 15) {
          // Can fit partially before commitment
          flexEnd = comStart;
        } else {
          // Move after commitment
          flexStart = comEnd;
          flexEnd = Math.min(23 * 60 + 59, flexStart + flexDuration);
        }
      }
    }

    if (flexEnd - flexStart >= MIN_BLOCK_MINUTES && flexEnd <= 24 * 60) {
      allScheduled.push({
        ...flex,
        start: minutesToTimeString(flexStart),
        end: minutesToTimeString(flexEnd),
      });
    }
  }

  // 4. Final sort and forward-shift for any remaining mutual overlaps among flexible items
  allScheduled.sort((a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start));

  const finalRepaired: ScheduleItem[] = [];
  let cursor = options.isToday && currentMinutes !== null ? currentMinutes : 0;

  for (const item of allScheduled) {
    let startMin = timeStringToMinutes(item.start);
    const endMin = timeStringToMinutes(item.end);

    if (item.type === "commitment") {
      // Fixed commitment must maintain its position if it hasn't passed
      if (startMin >= cursor && endMin > startMin) {
        finalRepaired.push(item);
        cursor = endMin;
      }
    } else {
      // Flexible item can be pushed forward if cursor is ahead
      if (startMin < cursor) startMin = cursor;
      if (endMin - startMin >= MIN_BLOCK_MINUTES && endMin <= 24 * 60) {
        finalRepaired.push({
          ...item,
          start: minutesToTimeString(startMin),
          end: minutesToTimeString(endMin),
        });
        cursor = endMin;
      }
    }
  }

  if (finalRepaired.length === 0) {
    throw new InvalidScheduleError("the proposed blocks overlapped too heavily to fit safely.");
  }

  return finalRepaired;
}
