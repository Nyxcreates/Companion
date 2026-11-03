import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

/** Extracts only the hostname from a mongodb+srv:// or mongodb:// URI — never the username or password. Returns null if parsing fails for any reason. */
function extractHostSafely(uri: string): string | null {
  try {
    // URL() can't parse mongodb+srv directly in older Node versions in
    // all cases, so normalize the scheme first for parsing purposes only.
    const normalized = uri.replace(/^mongodb(\+srv)?:\/\//, "https://");
    const url = new URL(normalized);
    return url.hostname || null;
  } catch {
    return null;
  }
}

function logConnectionFailure(error: unknown) {
  const err = error as { name?: string; code?: unknown; message?: string; cause?: unknown };
  const host = MONGODB_URI ? extractHostSafely(MONGODB_URI) : null;

  // eslint-disable-next-line no-console
  console.error(
    [
      "[Companion] MongoDB connection failed",
      `Error name: ${err?.name ?? "unknown"}`,
      `Error code: ${err?.code !== undefined ? String(err.code) : "none"}`,
      `Error message: ${err?.message ?? String(error)}`,
      `Error cause: ${err?.cause !== undefined ? String(err.cause) : "none"}`,
      `MONGODB_URI present: ${Boolean(MONGODB_URI)}`,
      `MongoDB host: ${host ?? "could not be parsed"}`,
    ].join("\n")
  );
}

/**
 * Returns a cached MongoDB connection, creating one if necessary.
 * On failure, clears cache.promise so the next call retries cleanly
 * instead of reusing a permanently rejected promise, and logs a
 * detailed (secret-free) diagnosis of what actually went wrong.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    // eslint-disable-next-line no-console
    console.error("[Companion] MongoDB connection failed\nMONGODB_URI present: false");
    throw new Error("MONGODB_URI is not set. Check your environment variables.");
  }

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }

  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (error) {
    cache.promise = null;
    logConnectionFailure(error);
    throw new Error("Could not connect to the database.");
  }
}