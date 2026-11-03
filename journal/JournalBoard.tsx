"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { JournalEntryCard } from "./JournalEntryCard";
import { JournalComposerModal } from "./JournalComposerModal";
import { groupEntriesByDay } from "@/lib/journal/format";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { JournalEntry } from "@/types/journal";

export function JournalBoard() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch("/api/journal", { method: "GET" });
      const { data, error: apiError } = await parseApiResponse<JournalEntry[]>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't load your journal.");
        return;
      }
      setEntries(data);
    } catch (err) {
      setError(err instanceof AuthFetchError ? err.message : "Couldn't load your journal.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved(entry: JournalEntry) {
    setEntries((prev) => {
      if (!prev) return [entry];
      const exists = prev.some((e) => e.id === entry.id);
      const next = exists ? prev.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...prev];
      // Keep the list newest-first regardless of whether this was a create or an edit.
      return [...next].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }

  function handleDeleted(id: string) {
    setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
  }

  const groups = entries ? groupEntriesByDay(entries) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-primary">Journal</h1>
          <p className="text-sm text-ink-muted">A private space for whatever's on your mind.</p>
        </div>
        <Button variant="primary" onClick={() => setComposerOpen(true)}>
          + New entry
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && entries === null && <LoadingState message="Opening your journal..." />}

      {!error && entries !== null && entries.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          message="Whenever you feel like writing, this space is yours."
          action={
            <Button variant="secondary" onClick={() => setComposerOpen(true)}>
              Write your first entry
            </Button>
          }
        />
      )}

      {!error &&
        groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{group.label}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.entries.map((entry) => (
                <JournalEntryCard key={entry.id} entry={entry} onOpen={setSelectedEntry} />
              ))}
            </div>
          </div>
        ))}

      {composerOpen && (
        <JournalComposerModal
          onClose={() => setComposerOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {selectedEntry && (
        <JournalComposerModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}