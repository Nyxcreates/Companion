"use client";

import { useEffect, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { authFetch } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { GoalSummary } from "@/types/goal";

interface GoalPickerProps {
  selectedGoalId: string | null;
  onChange: (goalId: string | null) => void;
  disabled?: boolean;
}

/**
 * A task's Goal link is optional, so "No goal" is always offered
 * alongside the user's active goals — never forcing a Goal selection.
 * Only ACTIVE goals are offered here; a paused/completed/archived
 * goal can still be attached via direct API use, but isn't surfaced
 * as a pickable option in this lightweight v1 picker.
 */
export function GoalPicker({ selectedGoalId, onChange, disabled }: GoalPickerProps) {
  const [goals, setGoals] = useState<GoalSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/goals?status=ACTIVE", { method: "GET" });
        const { data } = await parseApiResponse<GoalSummary[]>(res);
        if (!cancelled) setGoals(data ?? []);
      } catch {
        if (!cancelled) setGoals([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (goals === null) {
    return <p className="text-xs text-ink-muted">Loading your goals...</p>;
  }

  if (goals.length === 0) {
    return <p className="text-xs text-ink-muted">You don't have any active goals to link yet — that's okay.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Chip selected={selectedGoalId === null} onClick={() => onChange(null)} disabled={disabled}>
        No goal
      </Chip>
      {goals.map((goal) => (
        <Chip
          key={goal.id}
          selected={selectedGoalId === goal.id}
          onClick={() => onChange(goal.id)}
          disabled={disabled}
        >
          {goal.title}
        </Chip>
      ))}
    </div>
  );
}