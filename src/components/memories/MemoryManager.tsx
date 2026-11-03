"use client";

import { useCallback, useEffect, useState } from "react";
import { MemoryList } from "@/components/memory/MemoryList";
import { authFetch } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { MemorySummary } from "@/types/memory";

/** "What Nikki remembers" — the load/delete logic that used to live in the Settings page, so it can sit inside the Memories area. */
export function MemoryManager() {
  const [memories, setMemories] = useState<MemorySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch("/api/memory", { method: "GET" });
      const envelope = await parseApiResponse<MemorySummary[]>(res);
      if (!res.ok || envelope.error || !envelope.data) {
        throw new Error(envelope.error?.message ?? "Couldn't load what Nikki remembers.");
      }
      setMemories(envelope.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load what Nikki remembers.");
      setMemories([]);
    }
  }, []);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  async function handleDelete(memory: MemorySummary) {
    setDeletingId(memory.id);
    try {
      const res = await authFetch(`/api/memory/${memory.id}`, { method: "DELETE" });
      const envelope = await parseApiResponse<{ id: string; deleted: boolean }>(res);
      if (!res.ok || envelope.error) {
        throw new Error(envelope.error?.message ?? "Couldn't remove that memory just now.");
      }
      setMemories((prev) => (prev ? prev.filter((m) => m.id !== memory.id) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that memory just now.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <MemoryList
      memories={memories}
      error={error}
      onRetry={loadMemories}
      onDelete={handleDelete}
      deletingId={deletingId}
    />
  );
}