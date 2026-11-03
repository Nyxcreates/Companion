export class FocusPersistenceError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`Focus session persistence failed during ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "FocusPersistenceError";
  }
}

/** Thrown when a session's taskId doesn't resolve to a real Task owned by the same user — never trust a client-supplied task reference. */
export class InvalidTaskReferenceError extends Error {
  status = 400;
  constructor() {
    super("That task couldn't be found, so a focus session can't be started on it.");
    this.name = "InvalidTaskReferenceError";
  }
}

/** Thrown when starting a session while the user already has one ACTIVE or PAUSED — at most one at a time, so refresh/recovery never has to guess which one is "the" active session (spec section 18). */
export class SessionAlreadyActiveError extends Error {
  status = 409;
  constructor() {
    super("You already have a focus session in progress — finish or cancel it before starting another.");
    this.name = "SessionAlreadyActiveError";
  }
}

/** Thrown when an action (pause/resume/complete/cancel) doesn't make sense for the session's current status — e.g. pausing an already-completed session. */
export class SessionNotActionableError extends Error {
  status = 409;
  constructor(action: string, currentStatus: string) {
    super(`Can't ${action} a session that's already ${currentStatus.toLowerCase()}.`);
    this.name = "SessionNotActionableError";
  }
}