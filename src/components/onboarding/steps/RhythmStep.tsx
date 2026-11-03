"use client";

import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FOCUS_PERIOD_OPTIONS } from "@/lib/onboarding/options";

interface RhythmStepProps {
  wakeTime: string;
  sleepTime: string;
  focusPeriods: string[];
  commitments: string;
  onChangeWakeTime: (v: string) => void;
  onChangeSleepTime: (v: string) => void;
  onChangeFocusPeriods: (v: string[]) => void;
  onChangeCommitments: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

/** Lightweight — this only collects information for the future planner. No scheduling logic lives here. */
export function RhythmStep({
  wakeTime,
  sleepTime,
  focusPeriods,
  commitments,
  onChangeWakeTime,
  onChangeSleepTime,
  onChangeFocusPeriods,
  onChangeCommitments,
  onNext,
  onBack,
}: RhythmStepProps) {
  function toggle(id: string) {
    onChangeFocusPeriods(
      focusPeriods.includes(id) ? focusPeriods.filter((f) => f !== id) : [...focusPeriods, id]
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Usually wake up"
          type="time"
          value={wakeTime}
          onChange={(e) => onChangeWakeTime(e.target.value)}
        />
        <Input
          label="Usually wind down"
          type="time"
          value={sleepTime}
          onChange={(e) => onChangeSleepTime(e.target.value)}
        />
      </div>
      <div>
        <p className="mb-2 text-sm text-ink-secondary">When do you focus best?</p>
        <div className="flex flex-wrap gap-2">
          {FOCUS_PERIOD_OPTIONS.map((f) => (
            <Chip key={f.id} selected={focusPeriods.includes(f.id)} onClick={() => toggle(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>
      <Textarea
        label="Anything recurring I should know about? (optional)"
        value={commitments}
        onChange={(e) => onChangeCommitments(e.target.value)}
        placeholder="Classes, shifts, practice — whatever's regular for you"
        rows={2}
        maxLength={280}
      />
      <div className="flex justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}