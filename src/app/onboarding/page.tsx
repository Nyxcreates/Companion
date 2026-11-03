"use client";

import { LoadingState } from "@/components/ui/LoadingState";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useAppGuard } from "@/hooks/useAppGuard";

export default function OnboardingPage() {
  const { ready } = useAppGuard("onboarding");

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingState message="Just a moment..." />
      </main>
    );
  }

  return <OnboardingWizard />;
}