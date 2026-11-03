"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { JournalBoard } from "@/components/journal/JournalBoard";
import { useAppGuard } from "@/hooks/useAppGuard";

export default function JournalPage() {
  const { ready } = useAppGuard("dashboard");

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingState message="Just a moment..." />
      </main>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <JournalBoard />
      </div>
    </AppShell>
  );
}