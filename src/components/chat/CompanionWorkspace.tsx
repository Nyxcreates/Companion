"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { ConversationHistoryPanel } from "./ConversationHistoryPanel";
import { CompanionChatPanel } from "./CompanionChatPanel";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { ConversationSummary } from "@/types/conversation";

/**
 * Composes the history list and the chat panel, owning which
 * conversation is active. On desktop the history list sits
 * persistently beside the chat; on mobile it opens as a modal via a
 * "History" button, so a sidebar never squeezes the chat layout on a
 * small screen.
 */
export function CompanionWorkspace() {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isNewConversationPending, setIsNewConversationPending] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);

  const loadConversations = useCallback(async () => {
    setHistoryError(null);
    try {
      const res = await authFetch("/api/conversations", { method: "GET" });
      const envelope = await parseApiResponse<ConversationSummary[]>(res);
      if (!res.ok || envelope.error || !envelope.data) {
        throw new Error(envelope.error?.message ?? "Couldn't load your conversations.");
      }
      setConversations(envelope.data);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Couldn't load your conversations.");
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Auto-open the most recent conversation once, on first load — this
  // is what makes refreshing the page continue where you left off,
  // instead of showing an empty chat even though the conversation
  // still exists in MongoDB.
  useEffect(() => {
    if (hasAutoSelected || !conversations) return;
    if (conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
    setHasAutoSelected(true);
  }, [conversations, hasAutoSelected]);

    async function handleDeleteConversation(id: string) {
    const res = await authFetch(`/api/conversations/${id}`, { method: "DELETE" });
    const envelope = await parseApiResponse<{ ok: boolean }>(res);
    if (!res.ok || envelope.error) {
      throw new Error(envelope.error?.message ?? "Couldn't delete that conversation just now.");
    }
    // If the open conversation was deleted, return to a fresh one instead of showing stale messages.
    if (id === activeConversationId) {
      setActiveConversationId(null);
      setIsNewConversationPending(true);
    }
    setConversations((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
  }

  function handleSelect(id: string) {
    setActiveConversationId(id);
    setIsNewConversationPending(false);
    setIsMobileHistoryOpen(false);
  }

  function handleNewConversation() {
    setActiveConversationId(null);
    setIsNewConversationPending(true);
    setIsMobileHistoryOpen(false);
  }

  function handleConversationResolved(id: string) {
    setActiveConversationId(id);
    setIsNewConversationPending(false);
    loadConversations();
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <div className="hidden md:block md:w-72 md:shrink-0">
        <ConversationHistoryPanel
          conversations={conversations}
          error={historyError}
          activeConversationId={activeConversationId}
          onSelect={handleSelect}
          onNewConversation={handleNewConversation}
          onRetry={loadConversations}
          onDelete={handleDeleteConversation}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex justify-end md:hidden">
          <Button variant="secondary" size="sm" onClick={() => setIsMobileHistoryOpen(true)}>
            History
          </Button>
        </div>
        <CompanionChatPanel
          conversationId={activeConversationId}
          isNewConversationPending={isNewConversationPending}
          onConversationResolved={handleConversationResolved}
          onOpenHistory={() => setIsMobileHistoryOpen(true)}
        />
      </div>

      <Modal isOpen={isMobileHistoryOpen} onClose={() => setIsMobileHistoryOpen(false)} title="Conversations">
        <ConversationHistoryPanel
          conversations={conversations}
          error={historyError}
          activeConversationId={activeConversationId}
          onSelect={handleSelect}
          onNewConversation={handleNewConversation}
          onRetry={loadConversations}
          onDelete={handleDeleteConversation}
        />
      </Modal>
    </div>
  );
}