import type { NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/firebase/admin";

export class ApiAuthError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 401, code = "UNAUTHORIZED") {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
    this.code = code;
  }
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
  name: string | null;
}

/**
 * The single place every authenticated API route derives identity
 * from. Reads the Authorization header, verifies it with Firebase
 * Admin, and returns the verified UID. Never trust a UID supplied in
 * a request body or query string for ownership — only this.
 */
export async function requireAuthenticatedUser(request: NextRequest): Promise<VerifiedUser> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiAuthError("Missing or invalid Authorization header.");
  }

  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) {
    throw new ApiAuthError("Missing bearer token.");
  }

  try {
    const decoded = await verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null, name: decoded.name ?? null };
  } catch (error) {
    // Always log the real cause server-side.
    // eslint-disable-next-line no-console
    console.error("[Companion] Firebase token verification failed:", error);

    const message = error instanceof Error ? error.message : String(error);

    // Server misconfiguration (missing env vars) — safe to surface
    // exactly, since it only names variables, never values.
    if (message.startsWith("Firebase Admin credentials are missing")) {
      throw new ApiAuthError(message, 500, "ADMIN_NOT_CONFIGURED");
    }

    // Malformed private key — a very common copy/paste issue with
    // FIREBASE_ADMIN_PRIVATE_KEY. Detected from the error text, never
    // from the key value itself.
    if (
      message.toLowerCase().includes("failed to parse private key") ||
      message.toLowerCase().includes("invalid pem")
    ) {
      throw new ApiAuthError(
        "FIREBASE_ADMIN_PRIVATE_KEY looks malformed. Re-copy it from the Firebase console, wrap the whole value in double quotes, keep its \\n sequences, then restart the dev server.",
        500,
        "ADMIN_KEY_MALFORMED"
      );
    }

    // Otherwise: a genuinely invalid/expired token — the normal,
    // expected case a user should just re-sign-in for.
    throw new ApiAuthError("Your session is invalid or expired. Please sign in again.", 401, "UNAUTHORIZED");
  }
}