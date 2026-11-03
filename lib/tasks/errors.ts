/** Distinguishable task failure categories, mirroring lib/goals/errors.ts's pattern. */

export class TaskPersistenceError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`Task persistence failed during ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "TaskPersistenceError";
  }
}

/**
 * Thrown when a task's goalId doesn't resolve to a real Goal owned by
 * the same authenticated user — never trust a client-supplied goal
 * reference at face value (a task must never be attachable to another
 * user's goal, and a made-up/foreign id must never silently succeed).
 */
export class InvalidGoalReferenceError extends Error {
  status = 400;
  constructor() {
    super("That goal couldn't be found, so this task can't be linked to it.");
    this.name = "InvalidGoalReferenceError";
  }
}