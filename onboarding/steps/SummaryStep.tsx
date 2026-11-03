"use client";

import { Button } from "@/components/ui/Button";

interface SummaryStepProps {
  isSubmitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}

export function SummaryStep({ isSubmitting, error, onBack, onSubmit }: SummaryStepProps) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-ink-secondary">
        Okay. I think I have a better idea of where you're starting. We'll figure the rest out together.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-between gap-3">
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button onClick={onSubmit} isLoading={isSubmitting}>
          Enter Companion
        </Button>
      </div>
    </div>
  );
}