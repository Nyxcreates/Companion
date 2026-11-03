"use client";

import Link from "next/link";
import type { ScheduleItem, ScheduleSummary } from "@/types/schedule";

const TYPE_LABEL: Record<ScheduleItem["type"], string> = {
  task: "Task",
  break: "Break",
  commitment: "Commitment",
  free: "Free",
};

interface ScheduleTimelineProps {
  schedule: ScheduleSummary;
}

/** A clean daily timeline — deliberately not a calendar app. "Start Focus" links to the existing /focus page (not modified here) rather than duplicating any Focus Mode logic. */
export function ScheduleTimeline({ schedule }: ScheduleTimelineProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {new Date(`${schedule.date}T00:00:00`).toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
      <div className="flex flex-col divide-y divide-white/5">
        {schedule.items.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-3 py-2">
            <div>
              <p className="text-sm text-ink-primary">{item.title}</p>
              <p className="text-xs text-ink-muted">
                {item.start}–{item.end} · {TYPE_LABEL[item.type]}
              </p>
            </div>
            {item.type === "task" && item.taskId && (
              <Link
                href="/focus"
                className="shrink-0 rounded-full bg-accent-secondary/15 px-3 py-1 text-xs text-accent-secondary"
              >
                Start Focus
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}