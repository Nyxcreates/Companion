import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { softDeleteMemory } from "@/services/memoryService";
import { MemoryPersistenceError } from "@/lib/memory/errors";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/**
 * Deletes (soft-deletes) one memory — ONLY if it belongs to the
 * authenticated user. Once deleted it is immediately excluded from
 * both the Memory list and future chat context (spec section 15).
 *
 * Next.js 15: route params are async — must be awaited.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const deleted = await softDeleteMemory(id, user.uid);
    if (!deleted) {
      return NextResponse.json(
        { error: { message: "Memory not found.", code: "MEMORY_NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { id, deleted: true } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }

    // eslint-disable-next-line no-console
    console.error("[Companion] DELETE /api/memory/[id] failed:", error);

    if (error instanceof MemoryPersistenceError) {
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Couldn't remove that memory just now.", error),
            code: "MEMORY_PERSISTENCE_FAILED",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: { message: withDevDetail("Something went wrong removing that memory.", error), code: "UNKNOWN_ERROR" } },
      { status: 500 }
    );
  }
}