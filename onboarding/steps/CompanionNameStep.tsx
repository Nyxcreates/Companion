"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CompanionNameStepProps {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function CompanionNameStep({ value, onChange, onNext, onBack }: CompanionNameStepProps) {
  const [touched, setTouched] = useState(false);
  const trimmed = value.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 40;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Companion name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="Give me a name"
        autoFocus
        maxLength={40}
        helperText="Anything you like — this is entirely up to you."
        error={touched && !valid ? "Enter a name between 1 and 40 characters." : undefined}
      />
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