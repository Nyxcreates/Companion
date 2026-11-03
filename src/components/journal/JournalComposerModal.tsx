"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { MoodPicker } from "./MoodPicker";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import type { EmotionLabel } from "@/lib/ai/emotion";
import type { JournalEntry } from "@/types/journal";

interface JournalComposerModalProps {
  /** Present when editing an existing entry; absent when writing a new one. */
  entry?: JournalEntry;
  onClose: () => void;
  onSaved: (entry: JournalEntry) => void;
  onDeleted?: (id: string) => void;
}

/**
 * One modal handles both creating and editing — editing always PATCHes
 * the same document (never creates a duplicate, per spec section 9).
 * Uses the wide "lg" Modal size so writing doesn't feel like filling
 * out a cramped form (spec section 8).
 */
export function JournalComposerModal({ entry, onClose, onSaved, onDeleted }: JournalComposerModalProps) {
  const { showToast } = useToast();
  const isEditing = Boolean(entry);

  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [mood, setMood] = useState<EmotionLabel | null>(entry?.mood ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(entry?.title ?? "");
    setContent(entry?.content ?? "");
    setMood(entry?.mood ?? null);
  }, [entry]);

  async function handleSave() {
    setError(null);
    if (content.trim().length === 0) {
      setError("Write something first.");
      return;
    }

    setIsSaving(true);
    try {
      const res = isEditing
        ? await authFetch(`/api/journal/${entry!.id}`, {
            method: "PATCH",
            body: JSON.stringify({ title: title.trim() || null, content: content.trim(), mood }),
          })
        : await authFetch("/api/journal", {
            method: "POST",
            body: JSON.stringify({ title: title.trim() || undefined, content: content.trim(), mood: mood ?? undefined }),
          });

      const { data, error: apiError } = await parseApiResponse<JournalEntry>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't save that entry.");
        return;
      }
      onSaved(data);
      onClose();
    } catch (err) {
      if (err instanceof AuthFetchError) {
        showToast(err.message, "danger");
      } else {
        setError("Something went wrong saving that. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await authFetch(`/api/journal/${entry.id}`, { method: "DELETE" });
      const { data, error: apiError } = await parseApiResponse<{ ok: boolean }>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't delete that entry.");
        return;
      }
      onDeleted?.(entry.id);
      onClose();
    } catch (err) {
      if (err instanceof AuthFetchError) {
        showToast(err.message, "danger");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={isEditing ? "Edit entry" : "New entry"} size="lg">
      <div className="flex flex-col gap-4">
        <Input
          label="Title (optional)"
          placeholder="Give it a name, or leave it blank"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <Textarea
          label="What's on your mind?"
          placeholder="Write as much or as little as you want. This is just for you."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          maxLength={20000}
        />
        <MoodPicker value={mood} onChange={setMood} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          {isEditing ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">Delete this entry?</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} isLoading={isDeleting}>
                  Yes, delete
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )
          ) : (
            <span />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
              {isEditing ? "Save changes" : "Save entry"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}