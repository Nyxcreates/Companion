"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { HELP_OPTIONS } from "@/lib/onboarding/options";

interface HelpStepProps {
  helpPreferences: string[];
  onChange: (v: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function HelpStep({ helpPreferences, onChange, onNext, onBack }: HelpStepProps) {
  const [touched, setTouched] = useState(false);
  const valid = helpPreferences.length > 0;

  function toggle(id: string) {
    onChange(helpPreferences.includes(id) ? helpPreferences.filter((h) => h !== id) : [...helpPreferences, id]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {HELP_OPTIONS.map((h) => (
          <Chip key={h.id} selected={helpPreferences.includes(h.id)} onClick={() => toggle(h.id)}>
            {h.label}
          </Chip>
        ))}
      </div>
      {touched && !valid && (
        <p className="text-sm text-danger">Choose at least one — you can always change this later.</p>
      )}
      <div className="flex justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={() => {
            setTouched(true);
            if (valid) onNext();
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}