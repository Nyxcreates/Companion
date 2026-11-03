"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { groupConversationsByRecency, formatConversationTimestamp } from "@/lib/conversation/groupByRecency";
import type { ConversationSummary } from "@/types/conversation";

interface ConversationHistoryPanelProps {
  /** null = still loading. */
  conversations: ConversationSummary[] | null;
  error: string | null;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onRetry: () => void;
  /** Resolves when the conversation is really gone (or rejects with a message). */
  onDelete: (id: string) => Promise<void>;
}

export function ConversationHistoryPanel({
  conversations,
  error,
  activeConversationId,
  onSelect,
  onNewConversation,
  onRetry,
  onDelete,
}: ConversationHistoryPanelProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await onDelete(id);
      setConfirmingId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete that conversation.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="flex h-[28rem] flex-col overflow-hidden p-0">
      <div className="border-b border-white/10 p-3">
        <Button variant="secondary" size="sm" className="w-full" onClick={onNewConversation}>
          + New conversation
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {error && <ErrorState message={error} onRetry={onRetry} />}
        {deleteError && <p className="mb-2 px-2 text-sm text-danger">{deleteError}</p>}

        {!error && conversations === null && <LoadingState message="Loading your conversations..." />}

        {!error && conversations !== null && conversations.length === 0 && (
          <EmptyState title="No conversations yet" message="Whenever you're ready, we'll start one." />
        )}

        {!error &&
          conversations !== null &&
          conversations.length > 0 &&
          groupConversationsByRecency(conversations).map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.items.map((convo) => (
                  <div
                    key={convo.id}
                    className={clsx(
                      "group flex items-center gap-1 rounded-xl transition-colors duration-200",
                      activeConversationId === convo.id ? "bg-white/10" : "hover:bg-white/5"
                    )}
                  >
                    {confirmingId === convo.id ? (
                      <div className="flex w-full flex-col gap-2 px-3 py-2">
                        <span className="text-xs text-ink-muted">
                          Delete “{convo.title ?? "New conversation"}” and its messages?
                        </span>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)} disabled={deletingId === convo.id}>
                            Keep
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => confirmDelete(convo.id)} isLoading={deletingId === convo.id}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelect(convo.id)}
                          aria-current={activeConversationId === convo.id ? "true" : undefined}
                          className={clsx(
                            "flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl px-3 py-2 text-left",
                            activeConversationId === convo.id ? "text-ink-primary" : "text-ink-secondary hover:text-ink-primary"
                          )}
                        >
                          <span className="truncate text-sm font-medium">{convo.title ?? "New conversation"}</span>
                          {convo.preview && <span className="truncate text-xs text-ink-muted">{convo.preview}</span>}
                          <span className="text-[11px] text-ink-muted">{formatConversationTimestamp(convo.updatedAt)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setConfirmingId(convo.id);
                          }}
                          aria-label={`Delete conversation ${convo.title ?? "New conversation"}`}
                          className="mr-1 shrink-0 rounded-lg p-2 text-ink-muted opacity-70 transition-colors duration-200 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
}