"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { FOCUS_DURATION_PRESETS } from "@/lib/focus/constants";

interface DurationPickerProps {
  valueSeconds: number;
  onChange: (seconds: number) => void;
  disabled?: boolean;
}

/** Presets plus a custom-minutes fallback — never hard-coded to a single Pomodoro length (spec section 5). */
export function DurationPicker({ valueSeconds, onChange, disabled }: DurationPickerProps) {
  const matchesPreset = FOCUS_DURATION_PRESETS.some((preset) => preset.seconds === valueSeconds);
  const [customMinutes, setCustomMinutes] = useState(matchesPreset ? "" : String(Math.round(valueSeconds / 60)));
  const [useCustom, setUseCustom] = useState(!matchesPreset);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {FOCUS_DURATION_PRESETS.map((preset) => (
          <Chip
            key={preset.seconds}
            selected={!useCustom && valueSeconds === preset.seconds}
            disabled={disabled}
            onClick={() => {
              setUseCustom(false);
              onChange(preset.seconds);
            }}
          >
            {preset.label}
          </Chip>
        ))}
        <Chip selected={useCustom} disabled={disabled} onClick={() => setUseCustom(true)}>
          Custom
        </Chip>
      </div>

      {useCustom && (
        <Input
          label="Minutes"
          type="number"
          min={1}
          max={240}
          value={customMinutes}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            setCustomMinutes(raw);
            const minutes = Number(raw);
            if (Number.isFinite(minutes) && minutes > 0) {
              onChange(Math.round(minutes * 60));
            }
          }}
        />
      )}
    </div>
  );
}