export type FocusSessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

export interface FocusSessionSummary {
  id: string;
  taskId: string;
  taskTitle: string;
  goalId: string | null;
  goalTitle: string | null;
  status: FocusSessionStatus;
  plannedDurationSeconds: number;
  startedAt: string;
  /** Present only while status is PAUSED. */
  pausedAt: string | null;
  /** Total time already spent paused across all prior pause/resume cycles, in ms — combined with pausedAt/startedAt, lets the client derive elapsed/remaining without trusting a decrementing counter. */
  accumulatedPausedMs: number;
  /**
   * Server-computed at the moment of the response — a snapshot, not a
   * live value the client should treat as authoritative between
   * requests. The client re-derives its own ticking display from
   * startedAt/pausedAt/accumulatedPausedMs, matching the same math in
   * lib/focus/timer.ts.
   */
  elapsedSeconds: number;
  remainingSeconds: number;
  completedAt: string | null;
  cancelledAt: string | null;
  /** Set once the session ends (COMPLETED or CANCELLED) — the real, server-computed focused time, never assumed equal to plannedDurationSeconds. */
  actualDurationSeconds: number | null;
  createdAt: string;
}