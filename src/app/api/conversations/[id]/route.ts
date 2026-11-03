import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { getConversationWithMessages } from "@/services/conversationService";
import { deleteConversation } from "@/services/dataService";
import { DataPersistenceError } from "@/lib/data/errors";
import { ConversationPersistenceError } from "@/lib/ai/errors";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/**
 * Returns one conversation's metadata and its messages — ONLY if it
 * belongs to the authenticated user. A conversationId is never
 * treated as authorization by itself; ownership is checked against
 * the verified Firebase UID inside getConversationWithMessages.
 *
 * Next.js 15: route params are async — must be awaited.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);

    const result = await getConversationWithMessages(id, user.uid);
    if (!result) {
      return NextResponse.json(
        { error: { message: "Conversation not found.", code: "CONVERSATION_NOT_FOUND" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleConversationError(error);
  }
}

/** Deletes one conversation, its messages and emotion notes — ONLY if it belongs to the authenticated user. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const user = await requireAuthenticatedUser(request);
    const deleted = await deleteConversation(id, user.uid);
    if (deleted === null) {
      return NextResponse.json(
        { error: { message: "Conversation not found.", code: "CONVERSATION_NOT_FOUND" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof DataPersistenceError) {
      // eslint-disable-next-line no-console
      console.error("[Companion] DELETE /api/conversations/[id] failed:", error);
      return NextResponse.json(
        {
          error: {
            message: withDevDetail("Couldn't delete that conversation just now.", error),
            code: "CONVERSATION_PERSISTENCE_FAILED",
          },
        },
        { status: 500 }
      );
    }
    return handleConversationError(error);
  }
}

function handleConversationError(error: unknown): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  // eslint-disable-next-line no-console
  console.error("[Companion] GET /api/conversations/[id] failed:", error);

  if (error instanceof ConversationPersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't load that conversation just now.", error),
          code: "CONVERSATION_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: {
        message: withDevDetail("Something went wrong opening that conversation.", error),
        code: "UNKNOWN_ERROR",
      },
    },
    { status: 500 }
  );
}