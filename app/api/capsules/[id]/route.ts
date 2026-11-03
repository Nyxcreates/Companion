import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { getCapsuleDetail, deleteSealedCapsule } from "@/services/capsuleService";
import { CapsulePersistenceError, CapsuleNotSealedError } from "@/lib/capsules/errors";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/**
 * Returns one capsule's detail — ONLY if it belongs to the
 * authenticated user. Also serves as the "check unlock status" read:
 * the returned `status` field IS the authoritative check, computed
 * server-side from the real clock, so there's no separate endpoint
 * duplicating the same information.
 *
 * Next.js 15: route params are async — must be awaited.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const capsule = await getCapsuleDetail(id, user.uid);
    if (!capsule) {
      return NextResponse.json(
        { error: { message: "Capsule not found.", code: "CAPSULE_NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: capsule });
  } catch (error) {
    return handleCapsuleError(error, "GET /api/capsules/[id]");
  }
}

/** Removes a capsule — only while it's still SEALED. Once unlocked, a capsule is treated as a real memory rather than a draft and can't be silently deleted. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const deleted = await deleteSealedCapsule(id, user.uid);
    if (deleted === null) {
      return NextResponse.json(
        { error: { message: "Capsule not found.", code: "CAPSULE_NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleCapsuleError(error, "DELETE /api/capsules/[id]");
  }
}

function handleCapsuleError(error: unknown, routeLabel: string): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  if (error instanceof CapsuleNotSealedError) {
    return NextResponse.json(
      { error: { message: error.message, code: "CAPSULE_NOT_SEALED" } },
      { status: error.status }
    );
  }

  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);

  if (error instanceof CapsulePersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't reach that capsule just now.", error),
          code: "CAPSULE_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with that capsule.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}