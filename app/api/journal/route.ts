import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { createJournalEntry, listJournalEntries } from "@/services/journalService";
import { JournalPersistenceError } from "@/lib/journal/errors";
import { validateCreateJournalEntryPayload } from "@/lib/validation/journal";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/** Returns the authenticated user's own journal entries, most recent first. Never accepts a userId/firebaseUid from the client — identity always comes from the verified Firebase token. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const entries = await listJournalEntries(user.uid);
    return NextResponse.json({ data: entries });
  } catch (error) {
    return handleJournalError(error, "GET /api/journal");
  }
}

/** Creates a new journal entry for the authenticated user. Works entirely independently of Gemini/Nikki — nothing here calls the AI layer, so a Gemini outage never blocks saving. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, data } = validateCreateJournalEntryPayload(body);
    if (!valid) {
      return NextResponse.json({ error: { message: errors.join(" "), code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const entry = await createJournalEntry(user.uid, data);
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    return handleJournalError(error, "POST /api/journal");
  }
}

function handleJournalError(error: unknown, routeLabel: string): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);

  if (error instanceof JournalPersistenceError) {
    return NextResponse.json(
      { error: { message: withDevDetail("Couldn't reach your journal just now.", error), code: "JOURNAL_PERSISTENCE_FAILED" } },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: { message: withDevDetail("Something went wrong with your journal.", error), code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}