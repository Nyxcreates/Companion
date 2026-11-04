import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import { NotificationModel } from "@/models/Notification";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";
import { PushSubscriptionModel } from "@/models/PushSubscription";
import { UsageSessionModel } from "@/models/UsageSession";
import { CheckInHistoryModel } from "@/models/CheckInHistory";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { validateProfilePayload } from "@/lib/validation/profile";
import { toUserProfile } from "@/lib/api/serializeUser";
import { mapKnownServerError } from "@/lib/api/errorResponse";
import { deleteData } from "@/services/dataService";

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

/** Returns the authenticated user's own profile, or null if no MongoDB document exists yet. */
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

/** Creates (if missing) or updates the authenticated user's own profile. */
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
 * Permanently deletes the user's account and all associated collections.
 * Enforces confirmation phrase server-side.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json().catch(() => null)) as { confirmText?: unknown } | null;

    if (body?.confirmText !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        { error: { message: "Confirmation text must be 'DELETE MY ACCOUNT'.", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // 1. Delete all user content data (conversations, messages, capsules, tasks, goals, etc.)
    await deleteData(user.uid, "all");

    // 2. Delete notification models
    await Promise.all([
      NotificationModel.deleteMany({ firebaseUid: user.uid }),
      NotificationPreferenceModel.deleteMany({ firebaseUid: user.uid }),
      PushSubscriptionModel.deleteMany({ firebaseUid: user.uid }),
      UsageSessionModel.deleteMany({ firebaseUid: user.uid }),
      CheckInHistoryModel.deleteMany({ firebaseUid: user.uid }),
    ]);

    // 3. Delete the user document itself
    await UserModel.deleteOne({ firebaseUid: user.uid });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return handleRouteError(error, "DELETE /api/user/profile");
  }
}

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

    console.warn("[Companion] Duplicate-key race on profile upsert — retrying as plain update.");
    const existing = await UserModel.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: setFields },
      { new: true }
    );
    if (!existing) throw error;
    return existing;
  }
}
