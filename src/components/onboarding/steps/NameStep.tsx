"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface NameStepProps {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack?: () => void;
}

export function NameStep({ value, onChange, onNext, onBack }: NameStepProps) {
  const [touched, setTouched] = useState(false);
  const trimmed = value.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 60;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Your name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="What should I call you?"
        autoFocus
        maxLength={60}
        error={touched && !valid ? "Enter a name between 1 and 60 characters." : undefined}
      />
      <div className="flex justify-between gap-3">
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Change email
          </Button>
        ) : (
          <span />
        )}
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