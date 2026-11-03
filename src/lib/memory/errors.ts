export class MemoryPersistenceError extends Error {
  constructor(operation: string, cause: unknown) {
    super(
      `Memory persistence failed during ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = "MemoryPersistenceError";
  }
}