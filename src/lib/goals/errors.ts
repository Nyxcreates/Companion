/** Distinguishable goal failure categories, mirroring lib/capsules/errors.ts's pattern. */

export class GoalPersistenceError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`Goal persistence failed during ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "GoalPersistenceError";
  }
}

/**
 * Thrown when trying to delete a goal that's already COMPLETED —
 * a completed goal is kept as a permanent record of progress
 * (Nikki can reference it later as evidence), never silently removed.
 */
export class GoalCompletedError extends Error {
  status = 409;
  constructor() {
    super("Completed goals are kept as a record of your progress and can't be deleted — you can archive it instead.");
    this.name = "GoalCompletedError";
  }
}