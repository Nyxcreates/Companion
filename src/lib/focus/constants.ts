export interface FocusDurationPreset {
  label: string;
  seconds: number;
}

export const FOCUS_DURATION_PRESETS: FocusDurationPreset[] = [
  { label: "15 min", seconds: 15 * 60 },
  { label: "25 min", seconds: 25 * 60 },
  { label: "45 min", seconds: 45 * 60 },
  { label: "60 min", seconds: 60 * 60 },
];

/** Sanity bounds for a custom duration — not a product opinion about ideal focus length, just guarding against nonsense input (0, negative, or absurdly long). */
export const MIN_FOCUS_DURATION_SECONDS = 60; // 1 minute
export const MAX_FOCUS_DURATION_SECONDS = 4 * 60 * 60; // 4 hours