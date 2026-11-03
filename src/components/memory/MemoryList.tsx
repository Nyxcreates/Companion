"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MemorySummary, MemoryType } from "@/types/memory";

interface MemoryListProps {
  /** null = still loading. */
  memories: MemorySummary[] | null;
  error: string | null;
  onRetry: () => void;
  onDelete: (memory: MemorySummary) => void | Promise<void>;
  deletingId: string | null;
}

const TYPE_LABELS: Record<MemoryType, string> = {
  preference: "Preference",
  planning_preference: "Planning preference",
  goal_context: "Goal",
  habit: "Habit",
  recurring_pattern: "Pattern",
  important_context: "Important",
  explicit_remember_request: "You asked me to remember",
};

export function MemoryList({ memories, error, onRetry, onDelete, deletingId }: MemoryListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold text-ink-primary">What Nikki remembers</h2>
        <p className="text-sm text-ink-muted">
          Things worth carrying across conversations — you're always in control of what stays.
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!error && memories === null && <LoadingState message="Loading what Nikki remembers..." />}

      {!error && memories !== null && memories.length === 0 && (
        <EmptyState
          title="Nothing remembered yet"
          message="As you talk, Nikki will quietly pick up on lasting preferences and goals worth keeping — you'll see them show up here."
        />
      )}

      {!error && memories !== null && memories.length > 0 && (
        <div className="flex flex-col gap-2">
          {memories.map((memory) => (
            <Card key={memory.id} className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Chip className="pointer-events-none mb-2 px-3 py-1 text-xs" tabIndex={-1}>
                  {TYPE_LABELS[memory.type]}
                </Chip>
                <p className="text-sm text-ink-primary">{memory.content}</p>
              </div>
              {confirmingId === memory.id ? (
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="text-xs text-ink-muted">Forget this?</span>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)} disabled={deletingId === memory.id}>
                    Keep
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={deletingId === memory.id}
                    onClick={async () => {
                      await onDelete(memory);
                      setConfirmingId(null);
                    }}
                  >
                    Forget
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(memory.id)}
                  aria-label="Forget this memory"
                  className="flex-shrink-0 rounded-lg p-2 text-ink-muted transition-colors duration-200 hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}