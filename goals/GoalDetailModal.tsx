"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GOAL_OPTIONS } from "@/lib/onboarding/options";
import { GOAL_PRIORITY_OPTIONS } from "@/lib/goals/constants";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import type { GoalCategory, GoalPriority, GoalStatus, GoalSummary } from "@/types/goal";

interface GoalDetailModalProps {
  goal: GoalSummary;
  onClose: () => void;
  onUpdated: (goal: GoalSummary) => void;
  onDeleted: (id: string) => void;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function GoalDetailModal({ goal, onClose, onUpdated, onDeleted }: GoalDetailModalProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [category, setCategory] = useState<GoalCategory | null>(goal.category);
  const [priority, setPriority] = useState<GoalPriority>(goal.priority);
  const [deadline, setDeadline] = useState(toDateInputValue(goal.deadline));
  const [targetLabel, setTargetLabel] = useState(goal.targetLabel ?? "");
  const [targetValue, setTargetValue] = useState(goal.targetValue !== null ? String(goal.targetValue) : "");
  const [progressValue, setProgressValue] = useState(goal.progressValue !== null ? String(goal.progressValue) : "0");
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(goal.title);
    setDescription(goal.description ?? "");
    setCategory(goal.category);
    setPriority(goal.priority);
    setDeadline(toDateInputValue(goal.deadline));
    setTargetLabel(goal.targetLabel ?? "");
    setTargetValue(goal.targetValue !== null ? String(goal.targetValue) : "");
    setProgressValue(goal.progressValue !== null ? String(goal.progressValue) : "0");
  }, [goal]);

  async function patchGoal(payload: Record<string, unknown>): Promise<GoalSummary | null> {
    try {
      const res = await authFetch(`/api/goals/${goal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      const { data, error: apiError } = await parseApiResponse<GoalSummary>(res);
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
      setError("A goal needs a title.");
      return;
    }
    setIsSaving(true);
    const updated = await patchGoal({
      title: title.trim(),
      description: description.trim() || null,
      category,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      targetLabel: targetLabel.trim() || null,
      targetValue: targetValue.trim() ? Number(targetValue) : null,
      progressValue: targetValue.trim() ? Number(progressValue) : undefined,
    });
    setIsSaving(false);
    if (updated) onUpdated(updated);
  }

  async function handleStatusChange(status: GoalStatus) {
    setError(null);
    setIsChangingStatus(true);
    const updated = await patchGoal({ status });
    setIsChangingStatus(false);
    if (updated) onUpdated(updated);
  }

  async function handleDelete() {
    setError(null);
    try {
      const res = await authFetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      const { data, error: apiError } = await parseApiResponse<{ ok: boolean }>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't delete that goal.");
        return;
      }
      onDeleted(goal.id);
    } catch (err) {
      if (err instanceof AuthFetchError) {
        showToast(err.message, "danger");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  const isMeasurable = targetValue.trim().length > 0;

  return (
    <Modal isOpen onClose={onClose} title="Goal">
      <div className="flex flex-col gap-4">
        <Input label="Goal" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        <Textarea label="Why" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />

        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-secondary">Category</p>
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((opt) => (
              <Chip key={opt.id} selected={category === opt.id} onClick={() => setCategory(category === opt.id ? null : opt.id)}>
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-secondary">Priority</p>
          <div className="flex gap-2">
            {GOAL_PRIORITY_OPTIONS.map((opt) => (
              <Chip key={opt.value} selected={priority === opt.value} onClick={() => setPriority(opt.value)}>
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        <Input label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Target" type="number" min="0" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          <Input label="Unit" value={targetLabel} onChange={(e) => setTargetLabel(e.target.value)} maxLength={40} />
        </div>

        {isMeasurable && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-secondary">Progress</p>
              <p className="text-sm text-ink-muted">
                {progressValue} / {targetValue || "0"} {targetLabel}
              </p>
            </div>
            <input
              type="range"
              min={0}
              max={Number(targetValue) || 0}
              value={Number(progressValue) || 0}
              onChange={(e) => setProgressValue(e.target.value)}
              className="w-full accent-accent-secondary"
            />
            {goal.progressPercent !== null && <ProgressBar percent={goal.progressPercent} />}
          </div>
        )}

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
          {goal.status !== "PAUSED" && goal.status !== "COMPLETED" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("PAUSED")} isLoading={isChangingStatus}>
              Pause
            </Button>
          )}
          {goal.status === "PAUSED" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("ACTIVE")} isLoading={isChangingStatus}>
              Resume
            </Button>
          )}
          {goal.status !== "COMPLETED" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("COMPLETED")} isLoading={isChangingStatus}>
              Mark complete
            </Button>
          )}
          {goal.status !== "ARCHIVED" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("ARCHIVED")} isLoading={isChangingStatus}>
              Archive
            </Button>
          )}
          {goal.status === "ARCHIVED" && (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange("ACTIVE")} isLoading={isChangingStatus}>
              Restore
            </Button>
          )}

          {goal.status !== "COMPLETED" && (
            <div className="ml-auto flex items-center gap-2">
              {confirmingDelete ? (
                <>
                  <span className="text-xs text-ink-muted">Delete this goal?</span>
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
          )}
        </div>
      </div>
    </Modal>
  );
}