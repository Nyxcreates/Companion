/**
 * The emotion vocabulary Nikki can detect, and the conservative
 * fallback used whenever a reading is missing, malformed, or too
 * uncertain to trust. This is the single source of truth — imported
 * by both the Mongoose Emotion model (for its schema enum) and the
 * agent layer (for validation + prompt construction) — so the two
 * can never silently drift apart.
 *
 * Deliberately ordinary, conversational states only. No clinical or
 * diagnostic labels (no "depression," "anxiety disorder," etc.) — see
 * 11_DIALOGUE_GUIDE.md and the memory-foundation milestone spec.
 */
export type EmotionLabel =
  | "happy"
  | "calm"
  | "neutral"
  | "tired"
  | "stressed"
  | "sad"
  | "anxious"
  | "frustrated"
  | "excited"
  | "overwhelmed";

export const EMOTION_LABELS: EmotionLabel[] = [
  "happy",
  "calm",
  "neutral",
  "tired",
  "stressed",
  "sad",
  "anxious",
  "frustrated",
  "excited",
  "overwhelmed",
];

export interface AgentEmotion {
  emotion: EmotionLabel;
  intensity: number; // 0..1
  confidence: number; // 0..1
  secondaryEmotion?: EmotionLabel;
}

/** Used whenever emotion analysis is absent, malformed, or below the confidence floor — never invents certainty. */
export const NEUTRAL_EMOTION: AgentEmotion = { emotion: "neutral", intensity: 0, confidence: 0 };