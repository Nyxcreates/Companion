export interface ApiEnvelope<T> {
  data?: T;
  error?: { message: string; code?: string };
}

/**
 * Safely reads a fetch Response that is expected to carry a JSON API
 * envelope. Never lets JSON.parse throw uncaught — an empty or
 * malformed body produces a clear, honest ApiEnvelope error instead
 * of crashing the caller with "Unexpected end of JSON input". In
 * development, logs the raw (truncated) body so the real cause is
 * always visible, without ever hiding that something went wrong.
 */
export async function parseApiResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const rawText = await response.text();

  if (!rawText) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(
        `[Companion] Empty response body from ${response.url} (status ${response.status}). ` +
          "The server likely returned no content — check the server terminal for the actual error."
      );
    }
    return {
      error: {
        message: "The server returned an empty response. This can happen if it's still compiling — try again.",
        code: "EMPTY_RESPONSE",
      },
    };
  }

  try {
    return JSON.parse(rawText) as ApiEnvelope<T>;
  } catch (parseError) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(
        `[Companion] Non-JSON response body from ${response.url} (status ${response.status}). ` +
          `First 300 chars: ${rawText.slice(0, 300)}`,
        parseError
      );
    }
    return {
      error: {
        message: "The server returned an unexpected response. Please try again.",
        code: "INVALID_RESPONSE_FORMAT",
      },
    };
  }
}