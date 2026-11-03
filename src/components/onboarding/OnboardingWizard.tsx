"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { StepShell } from "./StepShell";
import { NameStep } from "./steps/NameStep";
import { CompanionNameStep } from "./steps/CompanionNameStep";
import { GoalsStep } from "./steps/GoalsStep";
import { RhythmStep } from "./steps/RhythmStep";
import { HelpStep } from "./steps/HelpStep";
import { SummaryStep } from "./steps/SummaryStep";
import { useProfile } from "@/context/ProfileContext";
import { useToast } from "@/context/ToastContext";

interface Draft {
  displayName: string;
  companionName: string;
  goals: string[];
  customGoal: string;
  wakeTime: string;
  sleepTime: string;
  focusPeriods: string[];
  commitments: string;
  helpPreferences: string[];
}

const DIALOGUE = [
  "Before we begin... what should I call you?",
  "And what should you call me?",
  "What are you working toward?",
  "Tell me a little about your day.",
  "How should I help?",
  "Okay.",
];

const TOTAL_STEPS = 6;

/** Six-step onboarding: name, companion name, goals, daily rhythm, help preferences, summary. Submits once, at the end, via ProfileContext.updateProfile. */
export function OnboardingWizard() {
  const router = useRouter();
  const { updateProfile } = useProfile();
  const { showToast } = useToast();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    displayName: "",
    companionName: "",
    goals: [],
    customGoal: "",
    wakeTime: "",
    sleepTime: "",
    focusPeriods: [],
    commitments: "",
    helpPreferences: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await updateProfile({
        displayName: draft.displayName.trim(),
        companionName: draft.companionName.trim(),
        goals: draft.goals,
        customGoal: draft.customGoal.trim(),
        dailyRhythm: {
          wakeTime: draft.wakeTime,
          sleepTime: draft.sleepTime,
          focusPeriods: draft.focusPeriods,
          commitments: draft.commitments.trim(),
        },
        helpPreferences: draft.helpPreferences,
        onboardingCompleted: true,
      });
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Let's try that again.";
      setSubmitError(message);
      showToast(message, "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-companion-gradient px-4 py-12">
      <AnimatePresence mode="wait">
        <StepShell
          key={step}
          dialogue={DIALOGUE[Math.min(step, DIALOGUE.length - 1)]}
          step={step}
          totalSteps={TOTAL_STEPS}
        >
          {step === 0 && (
            <NameStep
              value={draft.displayName}
              onChange={(v) => updateDraft("displayName", v)}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <CompanionNameStep
              value={draft.companionName}
              onChange={(v) => updateDraft("companionName", v)}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <GoalsStep
              goals={draft.goals}
              customGoal={draft.customGoal}
              onChangeGoals={(v) => updateDraft("goals", v)}
              onChangeCustomGoal={(v) => updateDraft("customGoal", v)}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <RhythmStep
              wakeTime={draft.wakeTime}
              sleepTime={draft.sleepTime}
              focusPeriods={draft.focusPeriods}
              commitments={draft.commitments}
              onChangeWakeTime={(v) => updateDraft("wakeTime", v)}
              onChangeSleepTime={(v) => updateDraft("sleepTime", v)}
              onChangeFocusPeriods={(v) => updateDraft("focusPeriods", v)}
              onChangeCommitments={(v) => updateDraft("commitments", v)}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <HelpStep
              helpPreferences={draft.helpPreferences}
              onChange={(v) => updateDraft("helpPreferences", v)}
              onNext={() => setStep(5)}
              onBack={() => setStep(3)}
            />
          )}
          {step === 5 && (
            <SummaryStep
              isSubmitting={isSubmitting}
              error={submitError}
              onBack={() => setStep(4)}
              onSubmit={handleSubmit}
            />
          )}
        </StepShell>
      </AnimatePresence>
    </main>
  );
}