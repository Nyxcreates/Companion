/** Distinguishable capsule failure categories, mirroring lib/ai/errors.ts's pattern for the conversation feature. */

export class CapsulePersistenceError extends Error {
  constructor(operation: string, cause: unknown) {
    super(
      `Capsule persistence failed during ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = "CapsulePersistenceError";
  }
}

/**
 * Thrown when opening a capsule whose unlock date hasn't passed yet.
 * The server is authoritative here — a client-side countdown
 * reaching zero is never trusted as authorization on its own.
 */
export class CapsuleNotReadyError extends Error {
  status = 403;
  constructor() {
    super("This one isn't ready to open yet.");
    this.name = "CapsuleNotReadyError";
  }
}

/**
 * Thrown when trying to delete a capsule that has already unlocked —
 * once a capsule's condition is met it's treated as a real memory,
 * not a draft, and isn't silently removable.
 */
export class CapsuleNotSealedError extends Error {
  status = 409;
  constructor() {
    super("This capsule has already unlocked, so it can't be removed.");
    this.name = "CapsuleNotSealedError";
  }
}