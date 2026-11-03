"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { GOAL_OPTIONS } from "@/lib/onboarding/options";
import { GOAL_PRIORITY_OPTIONS } from "@/lib/goals/constants";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import type { GoalCategory, GoalPriority, GoalSummary } from "@/types/goal";

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (goal: GoalSummary) => void;
}

export function CreateGoalModal({ isOpen, onClose, onCreated }: CreateGoalModalProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<GoalCategory | null>(null);
  const [priority, setPriority] = useState<GoalPriority>("MEDIUM");
  const [deadline, setDeadline] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setCategory(null);
    setPriority("MEDIUM");
    setDeadline("");
    setTargetLabel("");
    setTargetValue("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError(null);
    if (title.trim().length === 0) {
      setError("Give this goal a title first.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category: category ?? undefined,
          priority,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
          targetLabel: targetLabel.trim() || undefined,
          targetValue: targetValue.trim() ? Number(targetValue) : undefined,
        }),
      });
      const { data, error: apiError } = await parseApiResponse<GoalSummary>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't save that goal.");
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
    <Modal isOpen={isOpen} onClose={handleClose} title="What are you working toward?">
      <div className="flex flex-col gap-4">
        <Input
          label="Goal"
          placeholder="e.g. Learn Blender"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
        />
        <Textarea
          label="Why (optional)"
          placeholder="I want to be able to create 3D scenes."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
        />

        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-secondary">Category (optional)</p>
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

        <Input label="Deadline (optional)" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Measurable target (optional)"
            placeholder="e.g. 100"
            type="number"
            min="0"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
          />
          <Input
            label="Unit"
            placeholder="e.g. focus sessions"
            value={targetLabel}
            onChange={(e) => setTargetLabel(e.target.value)}
            maxLength={40}
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
            Create Goal
          </Button>
        </div>
      </div>
    </Modal>
  );
}