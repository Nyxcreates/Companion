/**
 * The controlled set of long-term memory categories (see the
 * long-term-memory milestone spec, section 9). Single source of
 * truth — imported by the Mongoose Memory model, the agent's
 * extraction contract, and the prompt builder, so all three can never
 * silently drift apart.
 */
export type MemoryType =
  | "preference"
  | "planning_preference"
  | "goal_context"
  | "habit"
  | "recurring_pattern"
  | "important_context"
  | "explicit_remember_request";

export const MEMORY_TYPES: MemoryType[] = [
  "preference",
  "planning_preference",
  "goal_context",
  "habit",
  "recurring_pattern",
  "important_context",
  "explicit_remember_request",
];

/**
 * Confidence tiers (spec section 7):
 * - HIGH (>= 0.75): clearly/explicitly stated — safe to save automatically.
 * - MEDIUM (0.4–0.75): plausible but not certain — must NOT silently
 *   become permanent memory. This implementation discards these
 *   rather than persisting an inert "pending" row, since no
 *   confirmation UI exists yet to ever act on one. The Memory
 *   model's `status` field is designed to grow a "pending" value
 *   later, once that UI exists, without migrating existing data.
 * - LOW (< 0.4): speculative — never saved, not even as a draft.
 */
export const HIGH_CONFIDENCE_THRESHOLD = 0.75;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.4;

export function confidenceTier(confidence: number): "high" | "medium" | "low" {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return "high";
  if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}