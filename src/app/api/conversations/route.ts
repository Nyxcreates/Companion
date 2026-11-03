import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { listConversations } from "@/services/conversationService";
import { ConversationPersistenceError } from "@/lib/ai/errors";
import { withDevDetail } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/** Returns the authenticated user's own conversations, most-recently-active first. Never accepts a userId from the client — identity always comes from the verified Firebase token. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const before = searchParams.get("before");

    let limit: number | undefined;
    if (limitParam !== null) {
      const parsed = Number(limitParam);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: { message: "limit must be a positive number.", code: "VALIDATION_ERROR" } },
          { status: 400 }
        );
      }
      limit = parsed;
    }

    const conversations = await listConversations(user.uid, { limit, before });
    return NextResponse.json({ data: conversations });
  } catch (error) {
    return handleConversationsError(error);
  }
}

function handleConversationsError(error: unknown): Response {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  // eslint-disable-next-line no-console
  console.error("[Companion] GET /api/conversations failed:", error);

  if (error instanceof ConversationPersistenceError) {
    return NextResponse.json(
      {
        error: {
          message: withDevDetail("Couldn't load your conversation history just now.", error),
          code: "CONVERSATION_PERSISTENCE_FAILED",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: {
        message: withDevDetail("Something went wrong loading your history.", error),
        code: "UNKNOWN_ERROR",
      },
    },
    { status: 500 }
  );
}