"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { CompanionWorkspace } from "@/components/chat/CompanionWorkspace";
import { DashboardWorldPresence } from "@/components/dashboard/DashboardWorldPresence";
import { PhoneUsageWidget } from "@/components/usage/PhoneUsageWidget";
import { useAppGuard } from "@/hooks/useAppGuard";

export default function DashboardPage() {
  const { ready, profile } = useAppGuard("dashboard");

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
        <DashboardWorldPresence />

        <h2 className="font-display text-xl font-semibold text-ink-primary">
          {profile?.companionName ? `Conversations with ${profile.companionName}` : "Conversations"}
        </h2>

        <CompanionWorkspace />

        <div id="phone-usage" className="pt-2">
          <PhoneUsageWidget />
        </div>
      </div>
    </AppShell>
  );
}
