import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import {
  getOrCreatePreferences,
  updatePreferences,
  resetLearnedPreferences,
} from "@/services/notificationService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const prefs = await getOrCreatePreferences(user.uid);
    return NextResponse.json({ data: prefs });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const prefs = await updatePreferences(user.uid, body);
    return NextResponse.json({ data: prefs });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const prefs = await resetLearnedPreferences(user.uid);
    return NextResponse.json({ data: prefs });
  } catch (error) {
    return handleRouteError(error);
  }
}

function handleRouteError(error: unknown) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Notification preferences error.";
  return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
}

