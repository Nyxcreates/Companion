/** Distinguishable journal failure category, mirroring lib/goals/errors.ts's and lib/capsules/errors.ts's pattern. */

export class JournalPersistenceError extends Error {
  constructor(operation: string, cause: unknown) {
    super(
      `Journal persistence failed during ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = "JournalPersistenceError";
  }
}