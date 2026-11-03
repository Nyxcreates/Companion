interface KnownError {
  status: number;
  code: string;
  message: string;
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Translates internal error messages into a safe, specific response.
 * Never includes secret values — only variable names or general
 * guidance.
 */
export function mapKnownServerError(error: unknown): KnownError | null {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("MONGODB_URI is not set")) {
    return {
      status: 500,
      code: "DB_NOT_CONFIGURED",
      message: "MONGODB_URI isn't set in .env.local. Add it, then fully restart the dev server.",
    };
  }

  if (message === "Could not connect to the database.") {
    return {
      status: 503,
      code: "DB_CONNECTION_ERROR",
      message:
        "Companion couldn't reach the database. In MongoDB Atlas, check Network Access allows your current IP address, and confirm MONGODB_URI is correct.",
    };
  }

  return null;
}

/**
 * In development ONLY, appends the real error's name/providerStatus/
 * code/message to a safe base message, so the actual failure — e.g.
 * a Gemini provider status code — is visible directly in the UI
 * without needing terminal access. In production this returns the
 * base message completely unchanged.
 */
export function withDevDetail(baseMessage: string, error: unknown): string {
  if (!isDev) return baseMessage;

  const err = error as {
    name?: string;
    code?: unknown;
    message?: string;
    providerStatus?: unknown;
  };
  const parts = [
    err?.name ? `[${err.name}]` : null,
    err?.providerStatus !== undefined ? `providerStatus=${String(err.providerStatus)}` : null,
    err?.code !== undefined ? `code=${String(err.code)}` : null,
    err?.message ?? String(error),
  ].filter(Boolean);

  return `${baseMessage} (dev detail: ${parts.join(" ")})`;
}