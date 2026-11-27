import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Verifies external cron requests using `Authorization: Bearer <CRON_SECRET>`.
 * Fails closed: returns false whenever CRON_SECRET is unset/empty or the
 * Bearer token does not match in constant time.
 */
export function verifyCronBearerToken(
  authHeader: string | null | undefined,
  cronSecret: string | undefined = process.env.CRON_SECRET
): boolean {
  const secret = cronSecret?.trim();
  if (!secret || !authHeader) {
    return false;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }

  const provided = match[1].trim();
  const expectedBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, providedBuf);
}

export function verifyCronAuth(request: NextRequest): boolean {
  return verifyCronBearerToken(request.headers.get("authorization"));
}
