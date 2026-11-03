"use client";

import { useEffect, useState } from "react";
import { TaskCard } from "@/components/tasks/TaskCard";
import { authFetch } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { TaskSummary } from "@/types/task";

interface TaskSelectorProps {
  onSelect: (task: TaskSummary) => void;
}

/**
 * A lightweight in-page picker for when the user opens Focus Mode
 * without a task already chosen — reuses the existing TaskCard
 * exactly as the Tasks page does, just wired to "select this one"
 * instead of "open its detail modal". Completed tasks are excluded;
 * focusing on something already finished doesn't fit the flow.
 */
export function TaskSelector({ onSelect }: TaskSelectorProps) {
  const [tasks, setTasks] = useState<TaskSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/tasks", { method: "GET" });
        const { data } = await parseApiResponse<TaskSummary[]>(res);
        if (!cancelled) setTasks((data ?? []).filter((task) => task.status !== "COMPLETED"));
      } catch {
        if (!cancelled) setTasks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (tasks === null) {
    return <p className="text-sm text-ink-muted">Loading your tasks...</p>;
  }

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        You don't have any open tasks yet — add one from the Tasks page first.
      </p>
    );
  }

  return (
    <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onOpen={onSelect} />
      ))}
    </div>
  );
}