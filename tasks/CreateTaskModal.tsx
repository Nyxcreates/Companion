"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { GoalPicker } from "./GoalPicker";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import type { TaskSummary } from "@/types/task";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (task: TaskSummary) => void;
}

export function CreateTaskModal({ isOpen, onClose, onCreated }: CreateTaskModalProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [goalId, setGoalId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setGoalId(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError(null);
    if (title.trim().length === 0) {
      setError("Give this task a title first.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          goalId: goalId ?? undefined,
        }),
      });
      const { data, error: apiError } = await parseApiResponse<TaskSummary>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't save that task.");
        return;
      }
      onCreated(data);
      handleClose();
    } catch (err) {
      if (err instanceof AuthFetchError) {
        showToast(err.message, "danger");
      } else {
        setError("Something went wrong saving that. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="What's the concrete next step?">
      <div className="flex flex-col gap-4">
        <Input
          label="Task"
          placeholder="e.g. Finish CNN notes"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <Textarea
          label="Notes (optional)"
          placeholder="Anything worth remembering about this."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
        />

        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-secondary">Part of a goal? (optional)</p>
          <GoalPicker selectedGoalId={goalId} onChange={setGoalId} disabled={submitting} />
        </div>

        <Input label="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
            Add task
          </Button>
        </div>
      </div>
    </Modal>
  );
}