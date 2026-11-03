"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { FocusExperience } from "@/components/focus/FocusExperience";
import { useAppGuard } from "@/hooks/useAppGuard";

function FocusPageContent() {
  const { ready } = useAppGuard("dashboard");
  const searchParams = useSearchParams();
  const initialTaskId = searchParams.get("taskId");

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingState message="Just a moment..." />
      </main>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <FocusExperience initialTaskId={initialTaskId} />
      </div>
    </AppShell>
  );
}

export default function FocusPage() {
  return (
    <Suspense fallback={<LoadingState message="Just a moment..." />}>
      <FocusPageContent />
    </Suspense>
  );
}