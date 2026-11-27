import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { mapKnownServerError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

/**
 * Ensures a bare MongoDB profile exists for the authenticated Firebase
 * user. Uses $setOnInsert only — never touches onboarding data on an
 * existing document, so calling this on every login is always safe.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));
    const rawTz = typeof body?.timezone === "string" ? body.timezone.trim() : "";
    let validTz: string | null = null;
    if (rawTz) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: rawTz });
        validTz = rawTz;
      } catch {
        validTz = null;
      }
    }

    await connectToDatabase();

    const doc = await upsertBareUser(user.uid, user.email, validTz);

    return NextResponse.json({
      data: { firebaseUid: doc.firebaseUid, onboardingCompleted: doc.onboardingCompleted },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }

    // eslint-disable-next-line no-console
    console.error("[Companion] POST /api/auth/sync failed:", error);

    const known = mapKnownServerError(error);
    if (known) {
      return NextResponse.json({ error: { message: known.message, code: known.code } }, { status: known.status });
    }

    return NextResponse.json(
      { error: { message: "Could not sync user.", code: "SYNC_FAILED" } },
      { status: 500 }
    );
  }
}

async function upsertBareUser(uid: string, email: string | null, timezone: string | null) {
  try {
    const doc = await UserModel.findOneAndUpdate(
      { firebaseUid: uid },
      { $setOnInsert: { firebaseUid: uid, email, ...(timezone ? { timezone } : {}) } },
      { new: true, upsert: true }
    );
    // Backfill timezone on existing users who still have no timezone saved
    if (doc && !doc.timezone && timezone) {
      doc.timezone = timezone;
      await doc.save().catch(() => {});
    }
    return doc;
  } catch (error) {
    const isDuplicateKey = (error as { code?: number })?.code === 11000;
    if (!isDuplicateKey) throw error;

    // eslint-disable-next-line no-console
    console.warn("[Companion] Duplicate-key race on sync upsert — re-reading existing document.");
    const existing = await UserModel.findOne({ firebaseUid: uid });
    if (!existing) throw error;
    if (!existing.timezone && timezone) {
      existing.timezone = timezone;
      await existing.save().catch(() => {});
    }
    return existing;
  }
}