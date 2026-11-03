import { EMOTION_LABELS, type EmotionLabel } from "@/lib/ai/emotion";
import type { CreateJournalEntryInput, UpdateJournalEntryInput } from "@/types/journal";

const MOOD_SET = new Set<string>(EMOTION_LABELS);

const MAX_TITLE_LENGTH = 120;
/** Generous — this is a writing space, not a form field; the limit exists only to reject pathological input. */
const MAX_CONTENT_LENGTH = 20_000;

export interface CreateJournalEntryValidationResult {
  valid: boolean;
  errors: string[];
  data: CreateJournalEntryInput;
}

/** The authoritative validator — run on the server for every journal write, following the same { valid, errors, data } convention as lib/validation/goal.ts, capsule.ts, agentChat.ts (this app has no Zod dependency anywhere). */
export function validateCreateJournalEntryPayload(body: unknown): CreateJournalEntryValidationResult {
  const errors: string[] = [];
  const data: CreateJournalEntryInput = { content: "" };

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["Invalid request body."], data };
  }
  const b = body as Record<string, unknown>;

  const content = typeof b.content === "string" ? b.content.trim() : "";
  if (content.length === 0 || content.length > MAX_CONTENT_LENGTH) {
    errors.push(`Write something first — up to ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`);
  } else {
    data.content = content;
  }

  if (b.title !== undefined) {
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (title.length > MAX_TITLE_LENGTH) {
      errors.push(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
    } else if (title.length > 0) {
      data.title = title;
    }
  }

  if (b.mood !== undefined) {
    if (typeof b.mood !== "string" || !MOOD_SET.has(b.mood)) {
      errors.push("Invalid mood.");
    } else {
      data.mood = b.mood as EmotionLabel;
    }
  }

  return { valid: errors.length === 0, errors, data };
}

export interface UpdateJournalEntryValidationResult {
  valid: boolean;
  errors: string[];
  data: UpdateJournalEntryInput;
}

/** Same field rules as create, but every field is optional/nullable for a partial update — explicit `null` clears title/mood. At least one recognized field must be present. */
export function validateUpdateJournalEntryPayload(body: unknown): UpdateJournalEntryValidationResult {
  const errors: string[] = [];
  const data: UpdateJournalEntryInput = {};

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["Invalid request body."], data };
  }
  const b = body as Record<string, unknown>;

  let touchedAnyField = false;

  if (b.content !== undefined) {
    touchedAnyField = true;
    const content = typeof b.content === "string" ? b.content.trim() : "";
    if (content.length === 0 || content.length > MAX_CONTENT_LENGTH) {
      errors.push(`Content must be between 1 and ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`);
    } else {
      data.content = content;
    }
  }

  if (b.title !== undefined) {
    touchedAnyField = true;
    if (b.title === null) {
      data.title = null;
    } else {
      const title = typeof b.title === "string" ? b.title.trim() : "";
      if (title.length > MAX_TITLE_LENGTH) {
        errors.push(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
      } else {
        data.title = title.length > 0 ? title : null;
      }
    }
  }

  if (b.mood !== undefined) {
    touchedAnyField = true;
    if (b.mood === null) {
      data.mood = null;
    } else if (typeof b.mood !== "string" || !MOOD_SET.has(b.mood)) {
      errors.push("Invalid mood.");
    } else {
      data.mood = b.mood as EmotionLabel;
    }
  }

  if (!touchedAnyField) {
    errors.push("No fields to update were provided.");
  }

  return { valid: errors.length === 0, errors, data };
}