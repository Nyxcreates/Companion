import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { getJournalEntry, updateJournalEntry, deleteJournalEntry } from "@/services/journalService";
import { JournalPersistenceError } from "@/lib/journal/errors";
import { validateUpdateJournalEntryPayload } from "@/lib/validation/journal";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/**
 * Returns one journal entry — ONLY if it belongs to the authenticated
 * user. Ownership is checked against the verified Firebase UID inside
 * getJournalEntry; an entry id is never treated as authorization by
 * itself.
 *
 * Next.js 15: route params are async — must be awaited.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const entry = await getJournalEntry(id, user.uid);
    if (!entry) {
      return NextResponse.json({ error: { message: "Entry not found.", code: "ENTRY_NOT_FOUND" } }, { status: 404 });
    }

    return NextResponse.json({ data: entry });
  } catch (error) {
    return handleError(error, "GET /api/journal/[id]");
  }
}

/** Updates an existing entry's title/content/mood. Editing never creates a duplicate — this always updates the same document, preserving createdAt and bumping updatedAt. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, data } = validateUpdateJournalEntryPayload(body);
    if (!valid) {
      return NextResponse.json({ error: { message: errors.join(" "), code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const entry = await updateJournalEntry(id, user.uid, data);
    if (!entry) {
      return NextResponse.json({ error: { message: "Entry not found.", code: "ENTRY_NOT_FOUND" } }, { status: 404 });
    }

    return NextResponse.json({ data: entry });
  } catch (error) {
    return handleError(error, "PATCH /api/journal/[id]");
  }
}

/** Permanently deletes one entry. Only ever matches a document owned by the authenticated user — deleting one user's entry can never affect another user's, since the query always filters on both _id AND firebaseUid together. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const deleted = await deleteJournalEntry(id, user.uid);
    if (deleted === null) {
      return NextResponse.json({ error: { message: "Entry not found.", code: "ENTRY_NOT_FOUND" } }, { status: 404 });
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    return handleError(error, "DELETE /api/journal/[id]");
  }
}

function handleError(error: unknown, routeLabel: string): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);

  if (error instanceof JournalPersistenceError) {
    return NextResponse.json(
      { error: { message: withDevDetail("Couldn't reach that entry just now.", error), code: "JOURNAL_PERSISTENCE_FAILED" } },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with that entry.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}