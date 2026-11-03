"use client";

import { Chip } from "@/components/ui/Chip";
import { EMOTION_LABELS, type EmotionLabel } from "@/lib/ai/emotion";

interface MoodPickerProps {
  value: EmotionLabel | null;
  onChange: (mood: EmotionLabel | null) => void;
}

const MOOD_LABELS: Record<EmotionLabel, string> = {
  happy: "Happy",
  calm: "Calm",
  neutral: "Neutral",
  tired: "Tired",
  stressed: "Stressed",
  sad: "Sad",
  anxious: "Anxious",
  frustrated: "Frustrated",
  excited: "Excited",
  overwhelmed: "Overwhelmed",
};

/** Entirely optional, user-chosen mood — never required before writing (spec section 6). Reuses the app's one existing emotion vocabulary (lib/ai/emotion.ts) instead of a second, conflicting mood list. */
export function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink-secondary">How are you feeling? (optional)</p>
      <div className="flex flex-wrap gap-2">
        {EMOTION_LABELS.map((mood) => (
          <Chip key={mood} selected={value === mood} onClick={() => onChange(value === mood ? null : mood)}>
            {MOOD_LABELS[mood]}
          </Chip>
        ))}
      </div>
    </div>
  );
}