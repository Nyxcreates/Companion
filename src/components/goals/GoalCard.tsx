"use client";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCategoryLabel, formatDeadlineLabel } from "@/lib/goals/format";
import type { GoalSummary } from "@/types/goal";

interface GoalCardProps {
  goal: GoalSummary;
  onOpen: (goal: GoalSummary) => void;
}

const STATUS_LABEL: Partial<Record<GoalSummary["status"], string>> = {
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export function GoalCard({ goal, onOpen }: GoalCardProps) {
  const metaParts = [formatCategoryLabel(goal.category), formatDeadlineLabel(goal.deadline)].filter(
    Boolean
  ) as string[];
  const statusLabel = STATUS_LABEL[goal.status];

  return (
    <button type="button" onClick={() => onOpen(goal)} className="w-full text-left" aria-label={`Open goal: ${goal.title}`}>
      <Card
        hoverable
        className={goal.status === "ARCHIVED" ? "opacity-60" : goal.status === "PAUSED" ? "opacity-80" : ""}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-medium text-ink-primary">{goal.title}</p>
            {metaParts.length > 0 && <p className="mt-0.5 text-xs text-ink-muted">{metaParts.join(" · ")}</p>}
          </div>
          {statusLabel && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-ink-secondary">
              {statusLabel}
            </span>
          )}
        </div>

        {goal.progressPercent !== null && (
          <div className="mt-3">
            <ProgressBar percent={goal.progressPercent} />
            <p className="mt-1 text-xs text-ink-muted">
              {goal.progressValue ?? 0}
              {goal.targetValue ? ` / ${goal.targetValue}` : ""}
              {goal.targetLabel ? ` ${goal.targetLabel}` : ""} · {goal.progressPercent}%
            </p>
          </div>
        )}
      </Card>
    </button>
  );
}