"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskCard } from "./TaskCard";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailModal } from "./TaskDetailModal";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { TaskStatus, TaskSummary } from "@/types/task";

const SECTION_ORDER: { status: TaskStatus; label: string }[] = [
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "PENDING", label: "Pending" },
  { status: "COMPLETED", label: "Completed" },
];

export function TaskBoard() {
  const [tasks, setTasks] = useState<TaskSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch("/api/tasks", { method: "GET" });
      const { data, error: apiError } = await parseApiResponse<TaskSummary[]>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't load your tasks.");
        return;
      }
      setTasks(data);
    } catch (err) {
      setError(err instanceof AuthFetchError ? err.message : "Couldn't load your tasks.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleUpdated(updated: TaskSummary) {
    setTasks((prev) => (prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev));
    setSelectedTask(updated);
  }

  function handleDeleted(id: string) {
    setTasks((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
    setSelectedTask(null);
  }

  const groups = tasks
    ? SECTION_ORDER.map((section) => ({
        ...section,
        items: tasks.filter((t) => t.status === section.status),
      })).filter((section) => section.items.length > 0)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-primary">Tasks</h2>
          <p className="text-sm text-ink-muted">The concrete next steps toward what you're working on.</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          + New task
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && tasks === null && <LoadingState message="Gathering your tasks..." />}

      {!error && tasks !== null && tasks.length === 0 && (
        <EmptyState
          title="No tasks yet"
          message="What's one concrete thing you could do next?"
          action={
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              Add your first task
            </Button>
          }
        />
      )}

      {!error &&
        groups.map((group) => (
          <div key={group.status} className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{group.label}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.items.map((task) => (
                <TaskCard key={task.id} task={task} onOpen={setSelectedTask} />
              ))}
            </div>
          </div>
        ))}

      <CreateTaskModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(task) => setTasks((prev) => (prev ? [task, ...prev] : [task]))}
      />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}