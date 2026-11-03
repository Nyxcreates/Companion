"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { GoalPicker } from "./GoalPicker";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import type { TaskStatus, TaskSummary } from "@/types/task";

interface TaskDetailModalProps {
  task: TaskSummary;
  onClose: () => void;
  onUpdated: (task: TaskSummary) => void;
  onDeleted: (id: string) => void;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function TaskDetailModal({ task, onClose, onUpdated, onDeleted }: TaskDetailModalProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [goalId, setGoalId] = useState<string | null>(task.goalId);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDueDate(toDateInputValue(task.dueDate));
    setGoalId(task.goalId);
  }, [task]);

  async function patchTask(payload: Record<string, unknown>): Promise<TaskSummary | null> {
    try {
      const res = await authFetch(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      const { data, error: apiError } = await parseApiResponse<TaskSummary>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't save that change.");
        return null;
      }
      return data;
    } catch (err) {
      if (err instanceof AuthFetchError) {
        showToast(err.message, "danger");
      } else {
        setError("Something went wrong. Please try again.");
      }
      return null;
    }
  }

  async function handleSave() {
    setError(null);
    if (title.trim().length === 0) {
      setError("A task needs a title.");
      return;
    }
    setIsSaving(true);
    const updated = await patchTask({
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      goalId,
    });
    setIsSaving(false);
    if (updated) onUpdated(updated);
  }

  async function handleStatusChange(status: TaskStatus) {
    setError(null);
    setIsChangingStatus(true);
    const updated = await patchTask({ status });
    setIsChangingStatus(false);
    if (updated) onUpdated(updated);
  }

  async function handleDelete() {
    setError(null);
    try {
      const res = await authFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const { data, error: apiError } = await parseApiResponse<{ ok: boolean }>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't delete that task.");
        return;
      }
      onDeleted(task.id);
    } catch (err) {
      if (err instanceof AuthFetchError) {
        showToast(err.message, "danger");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Task">
      <div className="flex flex-col gap-4">
        <Input label="Task" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <Textarea
          label="Notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
        />

        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-secondary">Part of a goal?</p>
          <GoalPicker selectedGoalId={goalId} onChange={setGoalId} disabled={isSaving} />
        </div>

        <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
            Save changes
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {task.status !== "COMPLETED" && (
            <Link href={`/focus?taskId=${task.id}`}>
              <Button variant="primary" size="sm">
                Start Focus
              </Button>
            </Link>
          )}
          {task.status === "PENDING" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("IN_PROGRESS")} isLoading={isChangingStatus}>
              Start
            </Button>
          )}
          {task.status === "IN_PROGRESS" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("PENDING")} isLoading={isChangingStatus}>
              Back to pending
            </Button>
          )}
          {task.status !== "COMPLETED" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("COMPLETED")} isLoading={isChangingStatus}>
              Mark complete
            </Button>
          )}
          {task.status === "COMPLETED" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("PENDING")} isLoading={isChangingStatus}>
              Reopen
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {confirmingDelete ? (
              <>
                <span className="text-xs text-ink-muted">Delete this task?</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete}>
                  Yes, delete
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}