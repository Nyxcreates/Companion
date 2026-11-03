"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { StartSessionPanel } from "./StartSessionPanel";
import { ActiveSessionPanel } from "./ActiveSessionPanel";
import { SessionResultPanel } from "./SessionResultPanel";
import { FocusHistoryList } from "./FocusHistoryList";
import { authFetch } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { FocusSessionSummary } from "@/types/focus";

interface FocusExperienceProps {
  initialTaskId: string | null;
}

/**
 * The Focus Mode state machine: recovers any in-progress session on
 * load (spec section 18), then shows exactly one of the start /
 * active / result panels. `historyRefreshKey` only changes when
 * returning to idle after a finished session, so the history list
 * refetches without any polling.
 */
export function FocusExperience({ initialTaskId }: FocusExperienceProps) {
  const [recovering, setRecovering] = useState(true);
  const [session, setSession] = useState<FocusSessionSummary | null>(null);
  const [result, setResult] = useState<FocusSessionSummary | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/focus/active", { method: "GET" });
        const { data } = await parseApiResponse<FocusSessionSummary | null>(res);
        if (!cancelled) setSession(data ?? null);
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setRecovering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChanged = useCallback((updated: FocusSessionSummary) => {
    if (updated.status === "COMPLETED" || updated.status === "CANCELLED") {
      setSession(null);
      setResult(updated);
    } else {
      setSession(updated);
    }
  }, []);

  const handleDone = useCallback(() => {
    setResult(null);
    setHistoryRefreshKey((n) => n + 1);
  }, []);

  if (recovering) {
    return <LoadingState message="Checking for an in-progress session..." />;
  }

  if (session) {
    return <ActiveSessionPanel session={session} onChanged={handleChanged} />;
  }

  if (result) {
    return <SessionResultPanel session={result} onDone={handleDone} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <StartSessionPanel initialTaskId={initialTaskId} onStarted={setSession} />
      <FocusHistoryList refreshKey={historyRefreshKey} />
    </div>
  );
}