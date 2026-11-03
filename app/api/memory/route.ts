import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { listActiveMemories } from "@/services/memoryService";
import { MemoryPersistenceError } from "@/lib/memory/errors";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/** Returns the authenticated user's own active memories. Never accepts a userId from the client — identity always comes from the verified Firebase token. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const memories = await listActiveMemories(user.uid);
    return NextResponse.json({ data: memories });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }

    // eslint-disable-next-line no-console
    console.error("[Companion] GET /api/memory failed:", error);

    if (error instanceof MemoryPersistenceError) {
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Couldn't load your memories just now.", error),
            code: "MEMORY_PERSISTENCE_FAILED",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: { message: withDevDetail("Something went wrong loading your memories.", error), code: "UNKNOWN_ERROR" } },
      { status: 500 }
    );
  }
}