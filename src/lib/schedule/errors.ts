export class SchedulePersistenceError extends Error {
  constructor(operation: string, cause: unknown) {
    super(
      `Schedule persistence failed during ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = "SchedulePersistenceError";
  }
}

/** Thrown when Gemini's structured schedule proposal fails deterministic validation and can't be safely repaired. */
export class InvalidScheduleError extends Error {
  constructor(reason: string) {
    super(`Companion couldn't build a valid schedule: ${reason}`);
    this.name = "InvalidScheduleError";
  }
}