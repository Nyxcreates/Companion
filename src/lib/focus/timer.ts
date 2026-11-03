/**
 * THE core timer-reliability guarantee for Focus Mode: elapsed and
 * remaining time are always derived from real timestamps
 * (startedAt / pausedAt / accumulatedPausedMs), never from a
 * decrementing counter. This file is the single place that math
 * happens — the server uses it to finalize a session on
 * complete/cancel, and the client imports the exact same function to
 * drive its live-ticking display, so the two can never compute
 * different answers.
 *
 * Pure functions only — no I/O, safe to import from both a Node API
 * route and a "use client" component.
 */

export interface TimerState {
  startedAt: Date;
  /** null when not currently paused. */
  pausedAt: Date | null;
  /** Sum of all PREVIOUS completed pause intervals, in ms — does not include time since the current pausedAt, if any. */
  accumulatedPausedMs: number;
}

/**
 * Effective focused time so far, in ms. While paused, this is frozen
 * at the moment pausedAt was recorded — pausing stops the clock
 * immediately and resuming never back-fills the gap.
 */
export function computeEffectiveElapsedMs(state: TimerState, now: Date = new Date()): number {
  const reference = state.pausedAt ?? now;
  const rawElapsed = reference.getTime() - state.startedAt.getTime();
  const elapsed = rawElapsed - state.accumulatedPausedMs;
  return Math.max(0, elapsed);
}

export function computeRemainingMs(
  state: TimerState,
  plannedDurationSeconds: number,
  now: Date = new Date()
): number {
  const plannedMs = plannedDurationSeconds * 1000;
  const elapsed = computeEffectiveElapsedMs(state, now);
  return Math.max(0, plannedMs - elapsed);
}

export function msToSeconds(ms: number): number {
  return Math.round(ms / 1000);
}

/** mm:ss (or h:mm:ss past an hour) — the timer's required text representation, since state must never be color-only (accessibility). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const mm = minutes.toString().padStart(hours > 0 ? 2 : 1, "0");
  const ss = seconds.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
}