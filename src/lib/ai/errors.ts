/** Distinguishable agent failure categories — so the API route (and its dev logging) never has to collapse everything into one generic error. */

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set.");
    this.name = "GeminiNotConfiguredError";
  }
}

export class GeminiRequestError extends Error {
  /** The provider's own HTTP status code, when the SDK exposes one — surfaced in dev detail to distinguish e.g. a 404 (bad model name) from a 401 (bad key) from a 429 (rate limit). */
  providerStatus?: number;

  constructor(cause: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(`Gemini request failed: ${causeMessage}`);
    this.name = "GeminiRequestError";

    const status = (cause as { status?: unknown })?.status;
    if (typeof status === "number") {
      this.providerStatus = status;
    }
  }
}

export class InvalidAgentResponseError extends Error {
  constructor(rawText: string, cause?: unknown) {
    super(
      `Gemini returned a response that didn't match the expected structure: ${
        cause instanceof Error ? cause.message : String(cause ?? "")
      }`
    );
    this.name = "InvalidAgentResponseError";
    this.rawText = rawText;
  }
  rawText: string;
}

export class AgentContextError extends Error {
  constructor(cause: unknown) {
    super(`Could not build agent context: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "AgentContextError";
  }
}

/**
 * Any failure while saving or loading conversation data (messages,
 * conversation get-or-create, recent-history lookups). Kept distinct
 * from AgentContextError so dev logs/API responses can tell "we
 * couldn't build Nikki's context" apart from "we couldn't persist
 * this conversation" — they point at different code paths.
 */
export class ConversationPersistenceError extends Error {
  constructor(operation: string, cause: unknown) {
    super(
      `Conversation persistence failed during ${operation}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
    this.name = "ConversationPersistenceError";
  }
}

/**
 * Thrown the moment a conversationId is missing or not a valid
 * MongoDB ObjectId, BEFORE it is ever handed to Mongoose. This is
 * what stands between "conversationId is somehow undefined" and a
 * raw Mongoose CastError/BSONError bubbling out of Message.create()
 * as an opaque 500 — the exact failure mode this class exists to
 * make impossible. Deliberately NOT a ConversationPersistenceError:
 * this is an input-validation problem (safe to report as 400), not a
 * database/persistence failure (500), and the two must stay
 * distinguishable in the API route's error handling.
 */
export class InvalidConversationIdError extends Error {
  reason: "missing" | "malformed";

  constructor(reason: "missing" | "malformed", value?: unknown) {
    super(
      reason === "missing"
        ? "conversationId is required."
        : `conversationId is not a valid identifier: ${String(value)}`
    );
    this.name = "InvalidConversationIdError";
    this.reason = reason;
  }
}