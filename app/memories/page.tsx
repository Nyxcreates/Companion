"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { MemoryGarden } from "@/components/garden/MemoryGarden";
import { CapsuleBoard } from "@/components/capsules/CapsuleBoard";
import { MemoryManager } from "@/components/memories/MemoryManager";
import { SectionTabs, useTabParam, panelId, tabId, type SectionTab } from "@/components/navigation/SectionTabs";
import { useAppGuard } from "@/hooks/useAppGuard";

const TABS: SectionTab[] = [
  { id: "garden", label: "Garden" },
  { id: "capsules", label: "Capsules" },
  { id: "remembered", label: "What Nikki remembers" },
];
const PREFIX = "memories";

function MemoriesContent() {
  const { ready } = useAppGuard("dashboard");
  const [tab, setTab] = useTabParam(TABS, "garden");

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingState message="Just a moment..." />
      </main>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-primary">Memories</h1>
          <p className="text-sm text-ink-muted">What you've kept, and what your companion carries with it.</p>
        </div>

        <SectionTabs tabs={TABS} activeId={tab} onChange={setTab} label="Memory sections" idPrefix={PREFIX} />

        <div role="tabpanel" id={panelId(PREFIX, tab)} aria-labelledby={tabId(PREFIX, tab)} tabIndex={0} className="focus:outline-none">
          {tab === "garden" && <MemoryGarden />}
          {tab === "capsules" && <CapsuleBoard />}
          {tab === "remembered" && <MemoryManager />}
        </div>
      </div>
    </AppShell>
  );
}

export default function MemoriesPage() {
  return (
    <Suspense fallback={<LoadingState message="Just a moment..." />}>
      <MemoriesContent />
    </Suspense>
  );
}