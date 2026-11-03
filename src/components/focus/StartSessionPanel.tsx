"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { SpeechBubble } from "@/components/character/SpeechBubble";
import { TaskSelector } from "./TaskSelector";
import { DurationPicker } from "./DurationPicker";
import { FOCUS_DURATION_PRESETS } from "@/lib/focus/constants";
import { pickBeforeFocusLine } from "@/lib/focus/dialogue";
import { formatDueDateLabel } from "@/lib/tasks/format";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import type { TaskSummary } from "@/types/task";
import type { FocusSessionSummary } from "@/types/focus";

interface StartSessionPanelProps {
  /** When Focus Mode was opened from a Task's own "Start Focus" link, this pre-selects that task and skips the picker. */
  initialTaskId: string | null;
  onStarted: (session: FocusSessionSummary) => void;
}

export function StartSessionPanel({ initialTaskId, onStarted }: StartSessionPanelProps) {
  const { showToast } = useToast();
  const [task, setTask] = useState<TaskSummary | null>(null);
  const [loadingInitialTask, setLoadingInitialTask] = useState(Boolean(initialTaskId));
  const [durationSeconds, setDurationSeconds] = useState(FOCUS_DURATION_PRESETS[1].seconds);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beforeLine] = useState(() => pickBeforeFocusLine());

  useEffect(() => {
    if (!initialTaskId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/tasks/${initialTaskId}`, { method: "GET" });
        const { data } = await parseApiResponse<TaskSummary>(res);
        if (!cancelled) setTask(data ?? null);
      } catch {
        if (!cancelled) setTask(null);
      } finally {
        if (!cancelled) setLoadingInitialTask(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialTaskId]);

  async function handleStart() {
    if (!task) return;
    setError(null);
    setStarting(true);
    try {
      const res = await authFetch("/api/focus", {
        method: "POST",
        body: JSON.stringify({ taskId: task.id, plannedDurationSeconds: durationSeconds }),
      });
      const { data, error: apiError } = await parseApiResponse<FocusSessionSummary>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't start that session.");
        return;
      }
      onStarted(data);
    } catch (err) {
      if (err instanceof AuthFetchError) {
        showToast(err.message, "danger");
      } else {
        setError("Something went wrong starting that session.");
      }
    } finally {
      setStarting(false);
    }
  }

  if (loadingInitialTask) {
    return <LoadingState message="Getting your task..." />;
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-20 w-20">
          <CompanionCharacter pose="idle" className="h-full w-full" />
        </div>
        <SpeechBubble>{beforeLine}</SpeechBubble>
      </div>

      <Card>
        <p className="text-sm text-ink-secondary">What are you focusing on?</p>
        {task ? (
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-base font-medium text-ink-primary">{task.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {[task.goalTitle ? `Goal: ${task.goalTitle}` : null, formatDueDateLabel(task.dueDate)]
                  .filter(Boolean)
                  .join(" · ") || "No goal or due date set"}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setTask(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <TaskSelector onSelect={setTask} />
          </div>
        )}
      </Card>

      {task && (
        <Card className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm text-ink-secondary">How long?</p>
            <DurationPicker valueSeconds={durationSeconds} onChange={setDurationSeconds} disabled={starting} />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button variant="primary" onClick={handleStart} isLoading={starting}>
            Start focus
          </Button>
        </Card>
      )}
    </div>
  );
}