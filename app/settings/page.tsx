"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/LoadingState";
import { AppearanceWorldSection } from "@/components/settings/AppearanceWorldSection";
import { NotificationSettingsSection } from "@/components/settings/NotificationSettingsSection";
import { DataPrivacySection } from "@/components/settings/DataPrivacySection";
import { useAppGuard } from "@/hooks/useAppGuard";

/**
 * Settings. Holds Appearance & Living World Customization,
 * Story Replay, and Data & Privacy.
 */
export default function SettingsPage() {
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
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <h1 className="font-display text-2xl font-semibold text-ink-primary">Settings</h1>
        <AppearanceWorldSection />
        <NotificationSettingsSection />
        <DataPrivacySection />
      </div>
    </AppShell>
  );
}
