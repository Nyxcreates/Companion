"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { RELATIVE_DURATION_OPTIONS } from "@/lib/capsules/unlock";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import type { CapsuleSummary, RelativeDurationOption } from "@/types/capsule";

interface CreateCapsuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (capsule: CapsuleSummary) => void;
}

type UnlockMode = "duration" | "date";

function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function CreateCapsuleModal({ isOpen, onClose, onCreated }: CreateCapsuleModalProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<UnlockMode>("duration");
  const [duration, setDuration] = useState<RelativeDurationOption>("3_months");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setMessage("");
    setMode("duration");
    setDuration("3_months");
    setDate("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError(null);

    if (message.trim().length === 0) {
      setError("Write something for your future self first.");
      return;
    }
    if (mode === "date" && !date) {
      setError("Choose an unlock date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch("/api/capsules", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || undefined,
          message: message.trim(),
          ...(mode === "duration" ? { relativeDuration: duration } : { unlockAt: new Date(date).toISOString() }),
        }),
      });
      const { data, error: apiError } = await parseApiResponse<CapsuleSummary>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't save that capsule.");
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Leave something for yourself">
      <div className="flex flex-col gap-4">
        <Input
          label="Title (optional)"
          placeholder="e.g. Before the internship starts"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
        />
        <Textarea
          label="Your message"
          placeholder="I hope you're proud of yourself. You were scared when you started this. Keep going."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={4000}
        />

        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink-secondary">When should this unlock?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("duration")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors duration-200 ${
                mode === "duration"
                  ? "border-accent-secondary/60 bg-accent-secondary/15 text-ink-primary"
                  : "border-white/15 bg-white/5 text-ink-secondary"
              }`}
            >
              After a while
            </button>
            <button
              type="button"
              onClick={() => setMode("date")}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-colors duration-200 ${
                mode === "date"
                  ? "border-accent-secondary/60 bg-accent-secondary/15 text-ink-primary"
                  : "border-white/15 bg-white/5 text-ink-secondary"
              }`}
            >
              A specific date
            </button>
          </div>

          {mode === "duration" ? (
            <div className="flex flex-wrap gap-2">
              {RELATIVE_DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  aria-pressed={duration === opt.value}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors duration-200 ${
                    duration === opt.value
                      ? "border-accent-secondary/60 bg-accent-secondary/15 text-ink-primary"
                      : "border-white/15 bg-white/5 text-ink-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <Input type="date" min={tomorrowDateString()} value={date} onChange={(e) => setDate(e.target.value)} />
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
            Seal it
          </Button>
        </div>
      </div>
    </Modal>
  );
}