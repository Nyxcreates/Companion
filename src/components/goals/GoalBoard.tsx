"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { GoalCard } from "./GoalCard";
import { CreateGoalModal } from "./CreateGoalModal";
import { GoalDetailModal } from "./GoalDetailModal";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { GoalStatus, GoalSummary } from "@/types/goal";

const SECTION_ORDER: { status: GoalStatus; label: string }[] = [
  { status: "ACTIVE", label: "Active" },
  { status: "PAUSED", label: "Paused" },
  { status: "COMPLETED", label: "Completed" },
  { status: "ARCHIVED", label: "Archived" },
];

export function GoalBoard() {
  const [goals, setGoals] = useState<GoalSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalSummary | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch("/api/goals", { method: "GET" });
      const { data, error: apiError } = await parseApiResponse<GoalSummary[]>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't load your goals.");
        return;
      }
      setGoals(data);
    } catch (err) {
      setError(err instanceof AuthFetchError ? err.message : "Couldn't load your goals.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleUpdated(updated: GoalSummary) {
    setGoals((prev) => (prev ? prev.map((g) => (g.id === updated.id ? updated : g)) : prev));
    setSelectedGoal(updated);
  }

  function handleDeleted(id: string) {
    setGoals((prev) => (prev ? prev.filter((g) => g.id !== id) : prev));
    setSelectedGoal(null);
  }

  const groups = goals
    ? SECTION_ORDER.map((section) => ({
        ...section,
        items: goals.filter((g) => g.status === section.status),
      })).filter((section) => section.items.length > 0)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
       <h2 className="font-display text-xl font-semibold text-ink-primary">Goals</h2>          <p className="text-sm text-ink-muted">Things you're working toward.</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          + New goal
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && goals === null && <LoadingState message="Finding what matters to you..." />}

      {!error && goals !== null && goals.length === 0 && (
        <EmptyState
          title="No goals yet"
          message="What's something you're working toward?"
          action={
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              Add your first goal
            </Button>
          }
        />
      )}

      {!error &&
        groups.map((group) => (
          <div key={group.status} className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{group.label}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.items.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onOpen={setSelectedGoal} />
              ))}
            </div>
          </div>
        ))}

      <CreateGoalModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(goal) => setGoals((prev) => (prev ? [goal, ...prev] : [goal]))}
      />

      {selectedGoal && (
        <GoalDetailModal
          goal={selectedGoal}
          onClose={() => setSelectedGoal(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}