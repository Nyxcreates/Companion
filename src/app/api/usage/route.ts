import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { UsageSessionModel } from "@/models/UsageSession";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    await connectToDatabase();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [sessions, pref] = await Promise.all([
      UsageSessionModel.find({
        firebaseUid: user.uid,
        startedAt: { $gte: startOfToday },
      }),
      NotificationPreferenceModel.findOne({ firebaseUid: user.uid }),
    ]);

    let appActiveSeconds = 0;
    let distractionFreeSeconds = 0;

    for (const s of sessions) {
      if (s.type === "app_active") {
        appActiveSeconds += s.durationSeconds;
      } else if (s.type === "distraction_free") {
        distractionFreeSeconds += s.durationSeconds;
      }
    }

    return NextResponse.json({
      data: {
        appActiveMinutes: Math.round(appActiveSeconds / 60),
        distractionFreeMinutes: Math.round(distractionFreeSeconds / 60),
        dailyGoalMinutes: pref?.dailyPhoneGoalMinutes ?? 120,
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch usage stats.";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    if (!body || !body.type || typeof body.durationSeconds !== "number" || body.durationSeconds <= 0) {
      return NextResponse.json(
        { error: { message: "Valid type and durationSeconds are required.", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - body.durationSeconds * 1000);

    const session = await UsageSessionModel.create({
      firebaseUid: user.uid,
      type: body.type,
      durationSeconds: Math.round(body.durationSeconds),
      startedAt,
      endedAt,
      metadata: body.metadata || {},
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to save usage session.";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

