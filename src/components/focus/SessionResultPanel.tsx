"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { SpeechBubble } from "@/components/character/SpeechBubble";
import { formatDuration } from "@/lib/focus/timer";
import { pickCompletedLine, pickCancelledLine } from "@/lib/focus/dialogue";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import type { FocusSessionSummary } from "@/types/focus";
import type { TaskSummary } from "@/types/task";

interface SessionResultPanelProps {
  session: FocusSessionSummary;
  onDone: () => void;
}

function formatMinutesLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

/**
 * Shown once a session is COMPLETED or CANCELLED. Never touches the
 * Task automatically — "Mark task complete" is an explicit, optional
 * action taken here using the existing task-update endpoint, not a
 * side effect Focus Mode imposes (spec sections 3/13/14).
 */
export function SessionResultPanel({ session, onDone }: SessionResultPanelProps) {
  const { showToast } = useToast();
  const [markingDone, setMarkingDone] = useState(false);
  const [taskMarkedComplete, setTaskMarkedComplete] = useState(false);

  const actualSeconds = session.actualDurationSeconds ?? 0;
  const line =
    session.status === "COMPLETED"
      ? pickCompletedLine(formatMinutesLabel(actualSeconds), session.taskTitle)
      : pickCancelledLine();

  async function handleMarkTaskComplete() {
    setMarkingDone(true);
    try {
      const res = await authFetch(`/api/tasks/${session.taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const { data, error } = await parseApiResponse<TaskSummary>(res);
      if (error || !data) {
        showToast(error?.message ?? "Couldn't update that task.", "danger");
        return;
      }
      setTaskMarkedComplete(true);
    } catch (err) {
      showToast(err instanceof AuthFetchError ? err.message : "Couldn't update that task.", "danger");
    } finally {
      setMarkingDone(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
      <div className="h-20 w-20">
        <CompanionCharacter pose={session.status === "COMPLETED" ? "celebrate" : "idle"} className="h-full w-full" />
      </div>
      <SpeechBubble>{line}</SpeechBubble>

      <Card className="w-full">
        <p className="text-sm text-ink-secondary">
          {session.status === "COMPLETED" ? "Session complete" : "Session ended early"}
        </p>
        <p className="mt-1 font-display text-lg font-medium text-ink-primary">{session.taskTitle}</p>
        <p className="mt-2 text-2xl font-semibold text-ink-primary">{formatDuration(actualSeconds)}</p>
        <p className="text-xs text-ink-muted">of {formatMinutesLabel(session.plannedDurationSeconds)} planned</p>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        {!taskMarkedComplete && (
          <Button variant="secondary" onClick={handleMarkTaskComplete} isLoading={markingDone}>
            Mark task complete
          </Button>
        )}
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}