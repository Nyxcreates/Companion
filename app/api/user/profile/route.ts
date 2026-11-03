import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { validateProfilePayload } from "@/lib/validation/profile";
import { toUserProfile } from "@/lib/api/serializeUser";
import { mapKnownServerError } from "@/lib/api/errorResponse";

export const runtime = "nodejs";

function handleRouteError(error: unknown, routeLabel: string) {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
  }

  // eslint-disable-next-line no-console
  console.error(`[Companion] ${routeLabel} failed:`, error);

  const known = mapKnownServerError(error);
  if (known) {
    return NextResponse.json({ error: { message: known.message, code: known.code } }, { status: known.status });
  }

  return NextResponse.json(
    { error: { message: "Something went wrong on our end. Please try again.", code: "UNKNOWN_ERROR" } },
    { status: 500 }
  );
}

/** Returns the authenticated user's own profile, or null if no MongoDB document exists yet (brand-new user). */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    await connectToDatabase();
    const doc = await UserModel.findOne({ firebaseUid: user.uid });
    return NextResponse.json({ data: doc ? toUserProfile(doc) : null });
  } catch (error) {
    return handleRouteError(error, "GET /api/user/profile");
  }
}

/** Creates (if missing) or updates the authenticated user's own profile. Identity always comes from the verified token — never from the request body. */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    const { valid, errors, data } = validateProfilePayload(body);
    if (!valid) {
      return NextResponse.json(
        { error: { message: errors.join(" "), code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const setFields: Record<string, unknown> = {};
    if (data.displayName !== undefined) setFields.displayName = data.displayName;
    if (data.companionName !== undefined) setFields.companionName = data.companionName;
    if (data.goals !== undefined) setFields.goals = data.goals;
    if (data.customGoal !== undefined) setFields.customGoal = data.customGoal;
    if (data.helpPreferences !== undefined) setFields.helpPreferences = data.helpPreferences;
    if (data.onboardingCompleted !== undefined) setFields.onboardingCompleted = data.onboardingCompleted;
    if (data.introCompleted !== undefined) setFields.introCompleted = data.introCompleted;
    if (data.theme !== undefined) setFields.theme = data.theme;
    if (data.livingEnvironment !== undefined) setFields.livingEnvironment = data.livingEnvironment;
    if (data.dailyRhythm) {
      if (data.dailyRhythm.wakeTime !== undefined) setFields["dailyRhythm.wakeTime"] = data.dailyRhythm.wakeTime;
      if (data.dailyRhythm.sleepTime !== undefined) setFields["dailyRhythm.sleepTime"] = data.dailyRhythm.sleepTime;
      if (data.dailyRhythm.focusPeriods !== undefined)
        setFields["dailyRhythm.focusPeriods"] = data.dailyRhythm.focusPeriods;
      if (data.dailyRhythm.commitments !== undefined)
        setFields["dailyRhythm.commitments"] = data.dailyRhythm.commitments;
    }

    const doc = await upsertProfile(user.uid, user.email, setFields);

    return NextResponse.json({ data: toUserProfile(doc) });
  } catch (error) {
    return handleRouteError(error, "PATCH /api/user/profile");
  }
}

/**
 * Upserts by firebaseUid, with one safe retry if a duplicate-key error
 * occurs (E11000) — e.g. if this request races with the sync-on-login
 * upsert for a genuinely brand-new user.
 */
async function upsertProfile(uid: string, email: string | null, setFields: Record<string, unknown>) {
  try {
    return await UserModel.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: setFields, $setOnInsert: { firebaseUid: uid, email } },
      { new: true, upsert: true }
    );
  } catch (error) {
    const isDuplicateKey = (error as { code?: number })?.code === 11000;
    if (!isDuplicateKey) throw error;

    // eslint-disable-next-line no-console
    console.warn("[Companion] Duplicate-key race on profile upsert — retrying as a plain update.");
    const existing = await UserModel.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: setFields },
      { new: true }
    );
    if (!existing) throw error;
    return existing;
  }
}