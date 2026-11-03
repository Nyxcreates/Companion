import { MIN_FOCUS_DURATION_SECONDS, MAX_FOCUS_DURATION_SECONDS } from "@/lib/focus/constants";

export interface StartSessionValidationResult {
  valid: boolean;
  errors: string[];
  data: { taskId: string; plannedDurationSeconds: number } | null;
}

/** The authoritative validator for starting a focus session — run server-side for every request. Never trusts a preset label from the client, only the resulting seconds value, so a "custom" duration is validated identically to a preset one. */
export function validateStartSessionPayload(body: unknown): StartSessionValidationResult {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["Invalid request body."], data: null };
  }
  const b = body as Record<string, unknown>;

  const taskId = typeof b.taskId === "string" ? b.taskId.trim() : "";
  if (taskId.length === 0) {
    errors.push("A task is required to start a focus session.");
  }

  const rawDuration = typeof b.plannedDurationSeconds === "number" ? b.plannedDurationSeconds : Number(b.plannedDurationSeconds);
  if (!Number.isFinite(rawDuration) || !Number.isInteger(rawDuration)) {
    errors.push("plannedDurationSeconds must be a whole number of seconds.");
  } else if (rawDuration < MIN_FOCUS_DURATION_SECONDS || rawDuration > MAX_FOCUS_DURATION_SECONDS) {
    errors.push(
      `Duration must be between ${MIN_FOCUS_DURATION_SECONDS / 60} minute(s) and ${MAX_FOCUS_DURATION_SECONDS / 3600} hours.`
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return { valid: true, errors: [], data: { taskId, plannedDurationSeconds: rawDuration } };
}

export type FocusSessionAction = "pause" | "resume" | "complete" | "cancel";

const VALID_ACTIONS: FocusSessionAction[] = ["pause", "resume", "complete", "cancel"];

export interface SessionActionValidationResult {
  valid: boolean;
  errors: string[];
  action: FocusSessionAction | null;
}

/** Validates the body of PATCH /api/focus/[id] — the single endpoint behind pause/resume/complete/cancel, since all four are ownership-checked state transitions on the same resource. */
export function validateSessionActionPayload(body: unknown): SessionActionValidationResult {
  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["Invalid request body."], action: null };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.action !== "string" || !VALID_ACTIONS.includes(b.action as FocusSessionAction)) {
    return { valid: false, errors: ['action must be "pause", "resume", "complete", or "cancel".'], action: null };
  }
  return { valid: true, errors: [], action: b.action as FocusSessionAction };
}