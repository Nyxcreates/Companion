"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { CapsuleCard } from "./CapsuleCard";
import { CreateCapsuleModal } from "./CreateCapsuleModal";
import { OpenCapsuleReveal } from "./OpenCapsuleReveal";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import type { CapsuleDetail, CapsuleStatus, CapsuleSummary } from "@/types/capsule";

const SECTION_ORDER: { status: CapsuleStatus; label: string }[] = [
  { status: "UNLOCKED", label: "Unlocked" },
  { status: "SEALED", label: "Sealed" },
  { status: "OPENED", label: "Opened" },
];

export function CapsuleBoard() {
  const [capsules, setCapsules] = useState<CapsuleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [openingCapsule, setOpeningCapsule] = useState<CapsuleSummary | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch("/api/capsules", { method: "GET" });
      const { data, error: apiError } = await parseApiResponse<CapsuleSummary[]>(res);
      if (apiError || !data) {
        setError(apiError?.message ?? "Couldn't load your capsules.");
        return;
      }
      setCapsules(data);
    } catch (err) {
      setError(err instanceof AuthFetchError ? err.message : "Couldn't load your capsules.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleOpened(detail: CapsuleDetail) {
    setCapsules((prev) =>
      prev
        ? prev.map((c) => (c.id === detail.id ? { ...c, status: detail.status, openedAt: detail.openedAt } : c))
        : prev
    );
  }

  const groups = capsules
    ? SECTION_ORDER.map((section) => ({
        ...section,
        items: capsules.filter((c) => c.status === section.status),
      })).filter((section) => section.items.length > 0)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-primary">Memory Capsules</h2>
          <p className="text-sm text-ink-muted">Something you left for yourself.</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          + Create a capsule
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && capsules === null && <LoadingState message="Finding what you left behind..." />}

      {!error && capsules !== null && capsules.length === 0 && (
        <EmptyState
          title="Nothing sealed yet"
          message="Write something for the person you'll become."
          action={
            <Button variant="secondary" onClick={() => setCreateOpen(true)}>
              Create your first capsule
            </Button>
          }
        />
      )}

      {!error &&
        groups.map((group) => (
          <div key={group.status} className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{group.label}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.items.map((capsule) => (
                <CapsuleCard key={capsule.id} capsule={capsule} onOpen={setOpeningCapsule} />
              ))}
            </div>
          </div>
        ))}

      <CreateCapsuleModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(capsule) => setCapsules((prev) => (prev ? [...prev, capsule] : [capsule]))}
      />

      {openingCapsule && (
        <OpenCapsuleReveal capsule={openingCapsule} onClose={() => setOpeningCapsule(null)} onOpened={handleOpened} />
      )}
    </div>
  );
}