"use client";

import { useEffect, useState } from "react";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { ScheduleTimeline } from "@/components/schedule/ScheduleTimeline";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { ScheduleSummary } from "@/types/schedule";

function dateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** The timetable (today + tomorrow). Moved out of the old /timetable page so it can live inside Plan; adds per-day delete. */
export function ScheduleView() {
  const [today, setToday] = useState<ScheduleSummary | null | undefined>(undefined);
  const [tomorrow, setTomorrow] = useState<ScheduleSummary | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"today" | "tomorrow" | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [resToday, resTomorrow] = await Promise.all([
          authFetch(`/api/schedule/${dateStr(0)}`, { method: "GET" }),
          authFetch(`/api/schedule/${dateStr(1)}`, { method: "GET" }),
        ]);
        const [envToday, envTomorrow] = await Promise.all([
          parseApiResponse<ScheduleSummary | null>(resToday),
          parseApiResponse<ScheduleSummary | null>(resTomorrow),
        ]);
        if (envToday.error || envTomorrow.error) {
          setError(envToday.error?.message ?? envTomorrow.error?.message ?? "Couldn't load your timetable.");
          return;
        }
        setToday(envToday.data ?? null);
        setTomorrow(envTomorrow.data ?? null);
      } catch (err) {
        setError(err instanceof AuthFetchError ? err.message : "Couldn't load your timetable.");
      }
    }
    load();
  }, []);

  async function handleDelete(which: "today" | "tomorrow") {
    const schedule = which === "today" ? today : tomorrow;
    if (!schedule) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/schedule/${schedule.date}`, { method: "DELETE" });
      const envelope = await parseApiResponse<{ ok: boolean }>(res);
      if (!res.ok || envelope.error) {
        throw new Error(envelope.error?.message ?? "Couldn't delete that timetable just now.");
      }
      if (which === "today") setToday(null);
      else setTomorrow(null);
      setConfirming(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that timetable just now.");
    } finally {
      setDeleting(false);
    }
  }

  function renderDay(which: "today" | "tomorrow", label: string, schedule: ScheduleSummary) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
          {confirming === which ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">Remove this timetable?</span>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={deleting}>
                Keep it
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(which)} isLoading={deleting}>
                Remove
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(which)}
              aria-label={`Delete ${label.toLowerCase()}'s timetable`}
            >
              Delete
            </Button>
          )}
        </div>
        <ScheduleTimeline schedule={schedule} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-primary">Timetable</h2>
        <p className="text-sm text-ink-muted">Ask your companion to plan your day, and it'll show up here.</p>
      </div>

      {error && <ErrorState message={error} />}

      {!error && today === undefined && <LoadingState message="Loading your schedule..." />}

      {!error && today !== undefined && !today && !tomorrow && (
        <EmptyState title="Nothing planned yet" message='Try asking: "Make me a timetable for tomorrow."' />
      )}

      {today && renderDay("today", "Today", today)}
      {tomorrow && renderDay("tomorrow", "Tomorrow", tomorrow)}
    </div>
  );
}