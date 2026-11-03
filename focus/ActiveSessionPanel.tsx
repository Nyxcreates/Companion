"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { formatDuration } from "@/lib/focus/timer";
import { useLiveFocusTimer } from "@/hooks/useFocusTimer";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import type { FocusSessionSummary } from "@/types/focus";

interface ActiveSessionPanelProps {
  session: FocusSessionSummary;
  onChanged: (session: FocusSessionSummary) => void;
}

/**
 * The in-session view — deliberately quiet (spec sections 19/20):
 * task, remaining time, pause/resume/exit, nothing else. Nikki stays
 * visually present (sitting nearby) without speaking during the
 * session itself. When the countdown reaches zero, the session is
 * completed automatically via the same server-authoritative endpoint
 * a manual action would use — the client never decides duration on
 * its own, it just notices `isDone` and asks the server to finalize.
 */
export function ActiveSessionPanel({ session, onChanged }: ActiveSessionPanelProps) {
  const { showToast } = useToast();
  const { remainingSeconds, elapsedSeconds, isDone } = useLiveFocusTimer(session);
  const [busy, setBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const hasAutoCompleted = useRef(false);

  async function sendAction(action: "pause" | "resume" | "complete" | "cancel") {
    setBusy(true);
    try {
      const res = await authFetch(`/api/focus/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      const { data, error } = await parseApiResponse<FocusSessionSummary>(res);
      if (error || !data) {
        showToast(error?.message ?? "Couldn't update that session.", "danger");
        return;
      }
      onChanged(data);
    } catch (err) {
      showToast(err instanceof AuthFetchError ? err.message : "Couldn't update that session.", "danger");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isDone && session.status === "ACTIVE" && !hasAutoCompleted.current) {
      hasAutoCompleted.current = true;
      sendAction("complete");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone, session.status]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
      <div className="h-20 w-20">
        <CompanionCharacter pose="sit" className="h-full w-full" />
      </div>

      <Card className="w-full">
        <p className="text-sm text-ink-secondary">Focusing on</p>
        <p className="mt-1 font-display text-lg font-medium text-ink-primary">{session.taskTitle}</p>
        {session.goalTitle && <p className="mt-0.5 text-xs text-ink-muted">Goal: {session.goalTitle}</p>}
      </Card>

      <div aria-live="polite" className="font-display text-6xl font-semibold text-ink-primary">
        {formatDuration(remainingSeconds)}
      </div>
      <p className="text-sm text-ink-muted">
        {session.status === "PAUSED" ? "Paused" : "Time remaining"} · {formatDuration(elapsedSeconds)} focused so far
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        {session.status === "ACTIVE" ? (
          <Button variant="secondary" onClick={() => sendAction("pause")} disabled={busy}>
            Pause
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => sendAction("resume")} disabled={busy}>
            Resume
          </Button>
        )}

        {confirmingCancel ? (
          <>
            <span className="self-center text-xs text-ink-muted">End this session?</span>
            <Button variant="ghost" onClick={() => setConfirmingCancel(false)} disabled={busy}>
              Keep going
            </Button>
            <Button variant="danger" onClick={() => sendAction("cancel")} disabled={busy}>
              Yes, end it
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmingCancel(true)} disabled={busy}>
            Exit
          </Button>
        )}
      </div>
    </div>
  );
}