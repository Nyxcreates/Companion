"use client";

import Link from "next/link";
import { Check, Calendar } from "lucide-react";
import type { ScheduleItem, ScheduleSummary } from "@/types/schedule";

const TYPE_LABEL: Record<ScheduleItem["type"], string> = {
  task: "Task",
  break: "Break",
  commitment: "Commitment",
  free: "Free",
};

interface ScheduleTimelineProps {
  schedule: ScheduleSummary;
  onSave?: () => void;
}

/** A clean daily timeline — preserved in conversation history and persistent in the schedule section. */
export function ScheduleTimeline({ schedule }: ScheduleTimelineProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          {new Date(`${schedule.date}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <Link
          href="/plan?tab=schedule"
          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
          title="View full schedule in Plan"
        >
          <Check className="h-3 w-3" />
          <span>Saved to Timetable</span>
        </Link>
      </div>
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