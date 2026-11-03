import { RELATIVE_DURATION_OPTIONS } from "@/lib/capsules/unlock";
import type { RelativeDurationOption } from "@/types/capsule";

const RELATIVE_DURATION_VALUES = new Set<string>(RELATIVE_DURATION_OPTIONS.map((o) => o.value));

export interface CreateCapsuleValidationResult {
  valid: boolean;
  errors: string[];
  data: {
    title: string | null;
    message: string;
    unlockAt?: string;
    relativeDuration?: RelativeDurationOption;
  };
}

/**
 * The authoritative validator — run on the server for every capsule
 * write. Exactly one of `unlockAt` or `relativeDuration` must be
 * present; the unlock date must genuinely be in the future, checked
 * against the server's own clock rather than trusting anything the
 * client computed.
 */
export function validateCreateCapsulePayload(body: unknown): CreateCapsuleValidationResult {
  const errors: string[] = [];
  const data: CreateCapsuleValidationResult["data"] = { title: null, message: "" };

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["Invalid request body."], data };
  }
  const b = body as Record<string, unknown>;

  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length === 0 || message.length > 4000) {
    errors.push("Your message must be between 1 and 4000 characters.");
  } else {
    data.message = message;
  }

  if (b.title !== undefined && b.title !== null) {
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (title.length > 80) {
      errors.push("Title must be 80 characters or fewer.");
    } else {
      data.title = title.length > 0 ? title : null;
    }
  }

  const hasUnlockAt = b.unlockAt !== undefined && b.unlockAt !== null;
  const hasRelativeDuration = b.relativeDuration !== undefined && b.relativeDuration !== null;

  if (hasUnlockAt && hasRelativeDuration) {
    errors.push("Choose either a specific date or a duration, not both.");
  } else if (!hasUnlockAt && !hasRelativeDuration) {
    errors.push("Choose when this capsule should unlock.");
  } else if (hasUnlockAt) {
    const parsed = typeof b.unlockAt === "string" ? new Date(b.unlockAt) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      errors.push("Invalid unlock date.");
    } else if (parsed.getTime() <= Date.now()) {
      errors.push("Unlock date must be in the future.");
    } else {
      data.unlockAt = parsed.toISOString();
    }
  } else if (hasRelativeDuration) {
    if (typeof b.relativeDuration !== "string" || !RELATIVE_DURATION_VALUES.has(b.relativeDuration)) {
      errors.push("Invalid duration option.");
    } else {
      data.relativeDuration = b.relativeDuration as RelativeDurationOption;
    }
  }

  return { valid: errors.length === 0, errors, data };
}