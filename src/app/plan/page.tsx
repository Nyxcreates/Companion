"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { GoalBoard } from "@/components/goals/GoalBoard";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { ScheduleView } from "@/components/schedule/ScheduleView";
import { SectionTabs, useTabParam, panelId, tabId, type SectionTab } from "@/components/navigation/SectionTabs";
import { useAppGuard } from "@/hooks/useAppGuard";

const TABS: SectionTab[] = [
  { id: "goals", label: "Goals" },
  { id: "tasks", label: "Tasks" },
  { id: "schedule", label: "Schedule" },
];
const PREFIX = "plan";

function PlanContent() {
  const { ready } = useAppGuard("dashboard");
  const [tab, setTab] = useTabParam(TABS, "tasks");

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingState message="Just a moment..." />
      </main>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-primary">Plan</h1>
          <p className="text-sm text-ink-muted">What you're working toward, what to do next, and when.</p>
        </div>

        <SectionTabs tabs={TABS} activeId={tab} onChange={setTab} label="Plan sections" idPrefix={PREFIX} />

        <div role="tabpanel" id={panelId(PREFIX, tab)} aria-labelledby={tabId(PREFIX, tab)} tabIndex={0} className="focus:outline-none">
          {tab === "goals" && <GoalBoard />}
          {tab === "tasks" && <TaskBoard />}
          {tab === "schedule" && <ScheduleView />}
        </div>
      </div>
    </AppShell>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<LoadingState message="Just a moment..." />}>
      <PlanContent />
    </Suspense>
  );
}