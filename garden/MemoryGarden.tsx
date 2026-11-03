"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { OpenCapsuleReveal } from "@/components/capsules/OpenCapsuleReveal";
import { GardenLandscape } from "./GardenLandscape";
import { GardenPlant } from "./GardenPlant";
import { GardenMemoryPanel } from "./GardenMemoryPanel";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { deriveLayout } from "@/lib/garden/derive";
import type { CapsuleDetail, CapsuleSummary } from "@/types/capsule";

/** Width of one layout column in px — keeps plants readable and tappable on small screens (the scene pans if the screen is narrower). */
const COLUMN_WIDTH = 112;
/** Above this many plants the idle sway is switched off so the garden stays smooth. */
const AMBIENT_LIMIT = 60;
/** Don't re-fetch on tab focus more often than this. */
const REFRESH_COOLDOWN_MS = 5000;

/**
 * Memory Garden — a visual layer over existing Memory Capsules.
 *
 * It reads the same GET /api/capsules the Capsules page uses (so
 * ownership is enforced by the existing authenticated route), derives
 * every plant from that list, and stores nothing of its own. Opening
 * and deleting stay in the existing Capsule experience; a capsule
 * removed there simply stops appearing here on the next load.
 */
export function MemoryGarden() {
  const router = useRouter();
  const [capsules, setCapsules] = useState<CapsuleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CapsuleSummary | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [revealing, setRevealing] = useState<CapsuleSummary | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const centeredRef = useRef(false);
  const lastLoadRef = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setError(null);
    lastLoadRef.current = Date.now();
    try {
      const res = await authFetch("/api/capsules", { method: "GET" });
      const { data, error: apiError } = await parseApiResponse<CapsuleSummary[]>(res);
      if (apiError || !data) {
        if (!silent) setError(apiError?.message ?? "Couldn't reach the garden just now.");
        return;
      }
      setCapsules(data);
    } catch (err) {
      if (!silent) setError(err instanceof AuthFetchError ? err.message : "Couldn't reach the garden just now.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Coming back to this tab is the natural moment things may have changed
  // (a capsule unlocked, was opened or removed elsewhere) — refresh quietly.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadRef.current < REFRESH_COOLDOWN_MS) return;
      load(true);
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  const layout = useMemo(() => (capsules ? deriveLayout(capsules) : null), [capsules]);
  const capsuleById = useMemo(() => new Map((capsules ?? []).map((c) => [c.id, c])), [capsules]);

  // On a narrow screen the scene is wider than the viewport, so once it
  // first appears, pan to where the plants are instead of an arbitrary edge.
  useEffect(() => {
    if (!layout || layout.plants.length === 0 || centeredRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    centeredRef.current = true;
    const meanX = layout.plants.reduce((sum, p) => sum + p.x, 0) / layout.plants.length / 100;
    el.scrollLeft = Math.max(0, meanX * el.scrollWidth - el.clientWidth / 2);
  }, [layout]);

  const handleSelect = useCallback((capsule: CapsuleSummary) => {
    setSelected(capsule);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);
  const closeReveal = useCallback(() => setRevealing(null), []);

  function handleOpenCapsule(capsule: CapsuleSummary) {
    setPanelOpen(false);
    setRevealing(capsule);
  }

  function handleOpened(detail: CapsuleDetail) {
    setCapsules((prev) =>
      prev ? prev.map((c) => (c.id === detail.id ? { ...c, status: detail.status, openedAt: detail.openedAt } : c)) : prev
    );
  }

  const isEmpty = capsules !== null && capsules.length === 0;
  const ambient = (layout?.plants.length ?? 0) <= AMBIENT_LIMIT;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-primary">Memory Garden</h2>
        <p className="text-sm text-ink-muted">A place for the things you chose to remember.</p>
      </div>

      {error && <ErrorState message={error} onRetry={() => load()} />}

      {!error && capsules === null && <LoadingState message="Walking out to the garden..." />}

      {!error && layout && capsules && (
        <div
          ref={scrollerRef}
          className="relative overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-2xl border border-white/10 shadow-card"
        >
          <div
            className="relative h-[25rem] md:h-[29rem]"
            style={isEmpty ? undefined : { minWidth: `${(layout.columns + 0.5) * COLUMN_WIDTH}px` }}
          >
            <GardenLandscape columns={layout.columns} />

            {layout.plants.map((plant, index) => {
              const capsule = capsuleById.get(plant.id);
              if (!capsule) return null;
              return (
                <GardenPlant
                  key={plant.id}
                  plant={plant}
                  capsule={capsule}
                  index={index}
                  ambient={ambient}
                  onSelect={handleSelect}
                />
              );
            })}

            {isEmpty && (
              <div className="absolute inset-x-0 bottom-[12%] z-[4] flex flex-col items-center gap-3 px-6 text-center">
                <div
                  aria-hidden="true"
                  className="h-3 w-24 rounded-[50%]"
                  style={{ background: "radial-gradient(ellipse at center, #1d3b31 0%, transparent 70%)" }}
                />
                <p className="font-display text-lg text-ink-primary">The garden is quiet for now.</p>
                <p className="max-w-xs text-sm text-ink-secondary">
                  Something meaningful will take root here, when it&apos;s ready.
                </p>
                <Button variant="ghost" size="sm" onClick={() => router.push("/memories?tab=capsules")}>
                  Leave something for future you
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

            <GardenMemoryPanel
        capsule={selected}
        isOpen={panelOpen}
        onClose={closePanel}
        onOpenCapsule={handleOpenCapsule}
        onGoToCapsules={() => router.push("/memories?tab=capsules")}
      />

      {revealing && <OpenCapsuleReveal capsule={revealing} onClose={closeReveal} onOpened={handleOpened} />}
    </div>
  );
}