/** Client-facing shapes for Memory Capsules — mirrors src/types/conversation.ts's pattern (plain, JSON-safe, no Mongo internals). */

export type CapsuleStatus = "SEALED" | "UNLOCKED" | "OPENED";

/**
 * Only date-based unlocking exists today. Written as a union of one
 * family on purpose, with future members documented here, so adding
 * milestone/goal-based unlocking later is additive — a new member,
 * new condition fields, extended validation — not a migration of
 * capsules that already exist.
 */
export type RelativeDurationOption = "1_week" | "1_month" | "3_months" | "6_months" | "1_year";

export interface CapsuleSummary {
  id: string;
  title: string | null;
  status: CapsuleStatus;
  unlockAt: string;
  createdAt: string;
  openedAt: string | null;
}

/**
 * The full capsule, returned only from the single-capsule and open
 * endpoints. `message` is present only once status is UNLOCKED or
 * OPENED — a SEALED capsule never carries its message to the client,
 * even to its own owner, until the unlock condition is actually met.
 */
export interface CapsuleDetail extends CapsuleSummary {
  message: string | null;
}

export interface CreateCapsuleInput {
  title?: string;
  message: string;
  unlockAt?: string;
  relativeDuration?: RelativeDurationOption;
}