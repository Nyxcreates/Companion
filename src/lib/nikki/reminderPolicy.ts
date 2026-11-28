/**
 * Pure policy helpers for Nikki's timetable item reminders, overdue goal
 * check-ins, snooze timing, per-item daily caps, and minimum message gaps.
 *
 * Kept free of database imports so it can be unit-tested directly and shared
 * across the decision engine (`decide.ts`) and API routes.
 */

export const MAX_ITEM_REMINDERS_PER_DAY = 3;
export const MIN_GAP_BETWEEN_UNPROMPTED_MINUTES = 10;
export const MIN_GAP_BETWEEN_UNPROMPTED_MS = MIN_GAP_BETWEEN_UNPROMPTED_MINUTES * 60 * 1000;

export const TERMINAL_TIMETABLE_STATUSES = new Set([
  "started",
  "done",
  "skipped",
]);

export function buildTimetableItemKey(
  uid: string,
  localDate: string,
  itemKey: string
): string {
  return `${uid}:timetable_unstarted:${localDate}:${itemKey}`;
}

export function buildTimetableNudgeIdempotencyKey(
  uid: string,
  localDate: string,
  itemKey: string,
  attemptNumber: number
): string {
  return `${buildTimetableItemKey(uid, localDate, itemKey)}:r${attemptNumber}`;
}

export function buildOverdueGoalIdempotencyKey(
  uid: string,
  localDate: string,
  goalId: string
): string {
  return `${uid}:goal_overdue:${goalId}:${localDate}`;
}

export function buildLongLaptopSessionIdempotencyKey(
  uid: string,
  localDate: string,
  bucket: number
): string {
  return `${uid}:long_laptop_session:${localDate}:${bucket}`;
}

/**
 * Computes the exact Date when a snoozed reminder should fire again.
 */
export function computeSnoozeUntil(nowMs: number, minutes: number): Date {
  const clamped = Math.max(1, Math.min(240, Math.round(minutes)));
  return new Date(nowMs + clamped * 60 * 1000);
}

/**
 * Returns true if at least `minGapMs` (default 10 minutes) has elapsed
 * since `lastGlobalNudgeAtMs`.
 */
export function hasMinGapElapsed(
  lastGlobalNudgeAtMs: number | null | undefined,
  nowMs: number,
  minGapMs: number = MIN_GAP_BETWEEN_UNPROMPTED_MS
): boolean {
  if (lastGlobalNudgeAtMs == null || !Number.isFinite(lastGlobalNudgeAtMs)) {
    return true;
  }
  return nowMs - lastGlobalNudgeAtMs >= minGapMs;
}

export interface TimetableItemEligibilityInput {
  status?: string | null;
  remindersSentCount: number;
  maxReminders?: number;
  snoozedUntilMs?: number | null;
  lastGlobalNudgeAtMs?: number | null;
  nowMs: number;
  minGapMs?: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reason:
    | "ok"
    | "terminal_status"
    | "cap_reached"
    | "snoozed"
    | "min_gap";
  nextAttempt?: number;
}

/**
 * Evaluates whether a timetable item is eligible for another reminder:
 *  - Stops immediately if status is started, done, or skipped
 *  - Caps at `maxReminders` (default 3) per item per day
 *  - Delays until `snoozedUntilMs` has elapsed
 *  - Enforces a minimum gap (default 10 minutes) between any two unprompted messages
 */
export function evaluateTimetableItemEligibility(
  input: TimetableItemEligibilityInput
): EligibilityResult {
  const normalizedStatus = (input.status || "pending").toLowerCase();
  if (TERMINAL_TIMETABLE_STATUSES.has(normalizedStatus)) {
    return { eligible: false, reason: "terminal_status" };
  }

  const maxReminders = input.maxReminders ?? MAX_ITEM_REMINDERS_PER_DAY;
  if (input.remindersSentCount >= maxReminders) {
    return { eligible: false, reason: "cap_reached" };
  }

  if (input.snoozedUntilMs != null && input.nowMs < input.snoozedUntilMs) {
    return { eligible: false, reason: "snoozed" };
  }

  const minGapMs = input.minGapMs ?? MIN_GAP_BETWEEN_UNPROMPTED_MS;
  if (!hasMinGapElapsed(input.lastGlobalNudgeAtMs, input.nowMs, minGapMs)) {
    return { eligible: false, reason: "min_gap" };
  }

  return {
    eligible: true,
    reason: "ok",
    nextAttempt: input.remindersSentCount + 1,
  };
}

export interface OverdueGoalEligibilityInput {
  alreadySentToday: boolean;
  dismissedToday?: boolean;
  snoozedUntilMs?: number | null;
  lastGlobalNudgeAtMs?: number | null;
  nowMs: number;
  minGapMs?: number;
}

/**
 * Evaluates whether an overdue goal/task reminder can fire today (at most once/day,
 * respecting "Not today" dismissal, snooze, and the 10-minute minimum message gap).
 */
export function evaluateOverdueGoalEligibility(
  input: OverdueGoalEligibilityInput
): { eligible: boolean; reason: "ok" | "already_sent_today" | "dismissed_today" | "snoozed" | "min_gap" } {
  if (input.dismissedToday) {
    return { eligible: false, reason: "dismissed_today" };
  }
  if (input.alreadySentToday) {
    return { eligible: false, reason: "already_sent_today" };
  }
  if (input.snoozedUntilMs != null && input.nowMs < input.snoozedUntilMs) {
    return { eligible: false, reason: "snoozed" };
  }
  const minGapMs = input.minGapMs ?? MIN_GAP_BETWEEN_UNPROMPTED_MS;
  if (!hasMinGapElapsed(input.lastGlobalNudgeAtMs, input.nowMs, minGapMs)) {
    return { eligible: false, reason: "min_gap" };
  }
  return { eligible: true, reason: "ok" };
}
