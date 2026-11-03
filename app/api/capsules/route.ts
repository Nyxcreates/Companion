import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { createCapsule, listCapsules } from "@/services/capsuleService";
import { CapsulePersistenceError } from "@/lib/capsules/errors";
import { validateCreateCapsulePayload } from "@/lib/validation/capsule";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/** Returns the authenticated user's own capsules. Never accepts a userId from the client — identity always comes from the verified Firebase token. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const capsules = await listCapsules(user.uid);
    return NextResponse.json({ data: capsules });
  } catch (error) {
    return handleCapsulesError(error, "GET /api/capsules");
  }
}

/** Creates a new capsule for the authenticated user. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, data } = validateCreateCapsulePayload(body);
    if (!valid) {
      return NextResponse.json({ error: { message: errors.join(" "), code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const capsule = await createCapsule({
      firebaseUid: user.uid,
      title: data.title,
      message: data.message,
      unlockAt: data.unlockAt,
      relativeDuration: data.relativeDuration,
    });

    return NextResponse.json({ data: capsule }, { status: 201 });
  } catch (error) {
    return handleCapsulesError(error, "POST /api/capsules");
  }
}

function handleCapsulesError(error: unknown, routeLabel: string): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);

  if (error instanceof CapsulePersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't reach your capsules just now.", error),
          code: "CAPSULE_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with your capsules.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}