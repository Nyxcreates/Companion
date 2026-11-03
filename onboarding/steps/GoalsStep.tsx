"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GOAL_OPTIONS } from "@/lib/onboarding/options";

interface GoalsStepProps {
  goals: string[];
  customGoal: string;
  onChangeGoals: (goals: string[]) => void;
  onChangeCustomGoal: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GoalsStep({
  goals,
  customGoal,
  onChangeGoals,
  onChangeCustomGoal,
  onNext,
  onBack,
}: GoalsStepProps) {
  const [touched, setTouched] = useState(false);
  const valid = goals.length > 0 || customGoal.trim().length > 0;

  function toggle(id: string) {
    onChangeGoals(goals.includes(id) ? goals.filter((g) => g !== id) : [...goals, id]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {GOAL_OPTIONS.map((g) => (
          <Chip key={g.id} selected={goals.includes(g.id)} onClick={() => toggle(g.id)}>
            {g.label}
          </Chip>
        ))}
      </div>
      <Input
        label="Something else? (optional)"
        value={customGoal}
        onChange={(e) => onChangeCustomGoal(e.target.value)}
        placeholder="Tell me in your own words"
        maxLength={140}
      />
      {touched && !valid && (
        <p className="text-sm text-danger">Choose at least one, or tell me in your own words.</p>
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