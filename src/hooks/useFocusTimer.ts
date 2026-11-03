"use client";

import { useEffect, useState } from "react";
import { computeEffectiveElapsedMs, computeRemainingMs, msToSeconds, type TimerState } from "@/lib/focus/timer";
import type { FocusSessionSummary } from "@/types/focus";

/**
 * Drives the live-ticking display for an ACTIVE session. Re-renders
 * once a second purely to force a fresh read of Date.now() — the
 * actual elapsed/remaining values are always recomputed from the
 * session's stored timestamps via lib/focus/timer.ts, never
 * accumulated locally (spec section 10). A PAUSED session needs no
 * ticking interval at all: its elapsed time is frozen until resumed.
 */
export function useLiveFocusTimer(session: FocusSessionSummary | null) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!session || session.status !== "ACTIVE") return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session || (session.status !== "ACTIVE" && session.status !== "PAUSED")) {
    return {
      elapsedSeconds: session?.actualDurationSeconds ?? 0,
      remainingSeconds: 0,
      isDone: Boolean(session),
    };
  }

  const timerState: TimerState = {
    startedAt: new Date(session.startedAt),
    pausedAt: session.pausedAt ? new Date(session.pausedAt) : null,
    accumulatedPausedMs: session.accumulatedPausedMs,
  };

  const elapsedMs = computeEffectiveElapsedMs(timerState);
  const remainingMs = computeRemainingMs(timerState, session.plannedDurationSeconds);

  return {
    elapsedSeconds: msToSeconds(elapsedMs),
    remainingSeconds: msToSeconds(remainingMs),
    isDone: remainingMs <= 0,
  };
}