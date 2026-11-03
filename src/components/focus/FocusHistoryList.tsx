"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDuration } from "@/lib/focus/timer";
import { authFetch } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { FocusSessionSummary } from "@/types/focus";

const STATUS_LABELS: Record<FocusSessionSummary["status"], string> = {
  ACTIVE: "In progress",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Ended early",
};

/** A simple, lightweight history — no charts, no scores (spec section 17). Refetches whenever refreshKey changes, which the parent bumps after a session finishes. */
export function FocusHistoryList({ refreshKey }: { refreshKey: number }) {
  const [sessions, setSessions] = useState<FocusSessionSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/focus", { method: "GET" });
        const { data } = await parseApiResponse<FocusSessionSummary[]>(res);
        if (!cancelled) setSessions(data ?? []);
      } catch {
        if (!cancelled) setSessions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (sessions === null) {
    return <LoadingState message="Loading your focus history..." />;
  }

  const finished = sessions.filter((s) => s.status === "COMPLETED" || s.status === "CANCELLED");

  if (finished.length === 0) {
    return <EmptyState title="No sessions yet" message="Your finished focus sessions will show up here." />;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Recent sessions</p>
      {finished.slice(0, 10).map((session) => (
        <Card key={session.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-ink-primary">{session.taskTitle}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {session.goalTitle ? `${session.goalTitle} · ` : ""}
              {new Date(session.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm text-ink-primary">{formatDuration(session.actualDurationSeconds ?? 0)}</p>
            <p className="text-xs text-ink-muted">{STATUS_LABELS[session.status]}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}