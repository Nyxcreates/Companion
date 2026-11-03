"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/context/ProfileContext";

type GuardStage = "dashboard" | "onboarding";

/**
 * The single place that decides where an authenticated user actually
 * belongs right now — used by both the dashboard and onboarding
 * pages so this decision is never duplicated or made inconsistently.
 * Makes exactly one redirect decision once loading has resolved,
 * avoiding the login → dashboard → onboarding → dashboard flicker
 * chain.
 */
export function useAppGuard(stage: GuardStage) {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const { profile, loading } = useProfile();

  const completed = profile?.onboardingCompleted ?? false;

  useEffect(() => {
    if (loading) return;

    if (!firebaseUser) {
      router.replace("/login");
      return;
    }

    if (stage === "dashboard" && !completed) {
      router.replace("/onboarding");
    } else if (stage === "onboarding" && completed) {
      router.replace("/dashboard");
    }
  }, [loading, firebaseUser, completed, stage, router]);

  const ready =
    !loading &&
    Boolean(firebaseUser) &&
    ((stage === "dashboard" && completed) || (stage === "onboarding" && !completed));

  return { ready, profile };
}