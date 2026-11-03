"use client";

import { Card } from "@/components/ui/Card";
import { formatDueDateLabel, formatTaskStatusLabel } from "@/lib/tasks/format";
import type { TaskSummary } from "@/types/task";

interface TaskCardProps {
  task: TaskSummary;
  onOpen: (task: TaskSummary) => void;
}

export function TaskCard({ task, onOpen }: TaskCardProps) {
  const metaParts = [task.goalTitle ? `Goal: ${task.goalTitle}` : null, formatDueDateLabel(task.dueDate)].filter(
    Boolean
  ) as string[];

  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="w-full text-left"
      aria-label={`Open task: ${task.title}`}
    >
      <Card hoverable className={task.status === "COMPLETED" ? "opacity-70" : ""}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className={`truncate font-display text-base font-medium text-ink-primary ${
                task.status === "COMPLETED" ? "line-through" : ""
              }`}
            >
              {task.title}
            </p>
            {metaParts.length > 0 && <p className="mt-0.5 text-xs text-ink-muted">{metaParts.join(" · ")}</p>}
          </div>
          {task.status === "IN_PROGRESS" && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-ink-secondary">
              {formatTaskStatusLabel(task.status)}
            </span>
          )}
        </div>
      </Card>
    </button>
  );
}