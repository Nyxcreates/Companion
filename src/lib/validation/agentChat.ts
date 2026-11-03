import { isValidTimezone } from "@/lib/time/currentTime";

export interface ValidatedChatRequest {
  message: string;
  /** null when the client has no conversation yet — the server will get-or-create one. */
  conversationId: string | null;
  /** True only when the user explicitly clicked "New conversation" — forces a brand-new conversation rather than reusing the most recent one. */
  newConversation: boolean;
  /** Optional client timezone (e.g. from Intl.DateTimeFormat().resolvedOptions().timeZone). */
  timezone?: string;
}

export interface ChatValidationResult {
  valid: boolean;
  errors: string[];
  data: ValidatedChatRequest | null;
}

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Server-side validation for the chat request body — never trust
 * client input. The client supplies the message, optionally which
 * conversation it belongs to, and optionally a "start fresh" signal;
 * conversation history itself is always loaded server-side from
 * MongoDB, never trusted from the client.
 */
export function validateAgentChatRequest(body: unknown): ChatValidationResult {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { valid: false, errors: ["Invalid request body."], data: null };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.message !== "string" || b.message.trim().length === 0) {
    errors.push("Message is required.");
  } else if (b.message.length > MAX_MESSAGE_LENGTH) {
    errors.push(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  let conversationId: string | null = null;
  if (b.conversationId !== undefined && b.conversationId !== null) {
    if (typeof b.conversationId !== "string" || b.conversationId.trim().length === 0) {
      errors.push("conversationId must be a non-empty string when provided.");
    } else {
      conversationId = b.conversationId;
    }
  }

  let newConversation = false;
  if (b.newConversation !== undefined) {
    if (typeof b.newConversation !== "boolean") {
      errors.push("newConversation must be a boolean when provided.");
    } else {
      newConversation = b.newConversation;
    }
  }

  let timezone: string | undefined = undefined;
  if (b.timezone !== undefined && b.timezone !== null) {
    if (typeof b.timezone === "string" && isValidTimezone(b.timezone)) {
      timezone = b.timezone.trim();
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      message: (b.message as string).trim(),
      conversationId,
      newConversation,
      ...(timezone ? { timezone } : {}),
    },
  };
}
