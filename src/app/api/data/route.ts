import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { getDataCounts, deleteData } from "@/services/dataService";
import { DataPersistenceError, InvalidDeleteRequestError } from "@/lib/data/errors";
import { CONFIRM_ALL_PHRASE, isDeleteScope } from "@/lib/data/scopes";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/** Per-type counts of the authenticated user's own data, for Settings → Data & Privacy. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    return NextResponse.json({ data: await getDataCounts(user.uid) });
  } catch (error) {
    return handleError(error, "GET /api/data");
  }
}

/**
 * Bulk deletion. Body: { scope, confirmed: true } for one data type,
 * or { scope: "all", confirmText: "DELETE" } for everything. The
 * server enforces the confirmation itself — the UI is not trusted to.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json().catch(() => null)) as {
      scope?: unknown;
      confirmed?: unknown;
      confirmText?: unknown;
    } | null;

    if (!body || !isDeleteScope(body.scope)) {
      throw new InvalidDeleteRequestError("Tell me which data to delete.");
    }
    if (body.scope === "all") {
      if (body.confirmText !== CONFIRM_ALL_PHRASE) {
        throw new InvalidDeleteRequestError(`To delete everything, type ${CONFIRM_ALL_PHRASE} to confirm.`);
      }
    } else if (body.confirmed !== true) {
      throw new InvalidDeleteRequestError("Please confirm before deleting.");
    }

    const result = await deleteData(user.uid, body.scope);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleError(error, "DELETE /api/data");
  }
}

function handleError(error: unknown, routeLabel: string): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }
  if (error instanceof InvalidDeleteRequestError) {
    return NextResponse.json({ error: { message: error.message, code: "VALIDATION_ERROR" } }, { status: 400 });
  }
  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);
  if (error instanceof DataPersistenceError) {
    return NextResponse.json(
      { error: { message: withDevDetail("Couldn't reach your data just now.", error), code: "DATA_PERSISTENCE_FAILED" } },
      { status: 500 }
    );
  }
  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with your data.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}