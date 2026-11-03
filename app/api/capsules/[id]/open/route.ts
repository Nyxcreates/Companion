import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { openCapsule } from "@/services/capsuleService";
import { CapsulePersistenceError, CapsuleNotReadyError } from "@/lib/capsules/errors";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/**
 * The only route that ever transitions a capsule to OPENED. The
 * server re-checks `unlockAt` against its own clock before allowing
 * this — a client-side countdown reaching zero is never trusted on
 * its own. Idempotent: opening an already-opened capsule just returns
 * it again rather than erroring.
 *
 * Next.js 15: route params are async — must be awaited.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const capsule = await openCapsule(id, user.uid);
    if (!capsule) {
      return NextResponse.json(
        { error: { message: "Capsule not found.", code: "CAPSULE_NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: capsule });
  } catch (error) {
    return handleOpenError(error);
  }
}

function handleOpenError(error: unknown): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  if (error instanceof CapsuleNotReadyError) {
    return NextResponse.json(
      { error: { message: error.message, code: "CAPSULE_NOT_READY" } },
      { status: error.status }
    );
  }

  // eslint-disable-next-line no-console
  console.error("[Companion] POST /api/capsules/[id]/open failed:", error);

  if (error instanceof CapsulePersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't open that capsule just now.", error),
          code: "CAPSULE_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong opening that.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}