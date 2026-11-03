export class DataPersistenceError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(
      `Data persistence failed during ${operation}${
        cause ? `: ${cause instanceof Error ? cause.message : String(cause)}` : ""
      }`
    );
    this.name = "DataPersistenceError";
  }
}

export class InvalidDeleteRequestError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidDeleteRequestError";
  }
}
