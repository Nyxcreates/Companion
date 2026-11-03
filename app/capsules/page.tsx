"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { CapsuleBoard } from "@/components/capsules/CapsuleBoard";
import { useAppGuard } from "@/hooks/useAppGuard";

export default function CapsulesPage() {
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
        <CapsuleBoard />
      </div>
    </AppShell>
  );
}