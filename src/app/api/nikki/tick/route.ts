import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import { buildNikkiContext } from "@/lib/nikki/context";
import { decideNikkiNudge } from "@/lib/nikki/decide";
import { speakNikkiNudge } from "@/lib/nikki/speak";

export const runtime = "nodejs";

const BATCH_SIZE = 20;

/**
 * Server-Side "Nikki Brain" Heartbeat Tick.
 *
 * Loops over eligible users in batches:
 *   1. Builds an owner-scoped context snapshot (schedule, tasks, moods, quiet hours).
 *   2. Evaluates pure rules (decide) to see IF Nikki should speak (cheap, no AI).
 *   3. If a trigger fires, calls Gemini with persona prompt (speak) and dispatches via push.
 *
 * Protected by CRON_SECRET via:
 *   - Header: Authorization: Bearer <CRON_SECRET>
 *   - Query: ?key=<CRON_SECRET>
 *
 * Never prints or leaks secret values.
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const urlKey = request.nextUrl.searchParams.get("key");
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || urlKey === cronSecret;

      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    await connectToDatabase();

    let skip = 0;
    let totalProcessed = 0;
    let spokenCount = 0;
    const results: Array<{
      firebaseUid: string;
      shouldSpeak: boolean;
      trigger?: string;
      reason: string;
      nudgeId?: string;
    }> = [];

    // Process users in batches
    while (true) {
      const users = await UserModel.find({})
        .select("firebaseUid")
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();

      if (!users || users.length === 0) break;

      for (const u of users) {
        totalProcessed++;
        try {
          const context = await buildNikkiContext(u.firebaseUid);
          const decision = decideNikkiNudge(context);

          if (decision.shouldSpeak) {
            const nudge = await speakNikkiNudge(context, decision);
            spokenCount++;
            results.push({
              firebaseUid: u.firebaseUid,
              shouldSpeak: true,
              trigger: decision.trigger,
              reason: decision.reason,
              nudgeId: nudge ? String(nudge._id) : undefined,
            });
          } else {
            results.push({
              firebaseUid: u.firebaseUid,
              shouldSpeak: false,
              reason: decision.reason,
            });
          }
        } catch (userErr) {
          console.warn(`[Companion Nikki Brain] Error processing user ${u.firebaseUid}:`, userErr);
          results.push({
            firebaseUid: u.firebaseUid,
            shouldSpeak: false,
            reason: userErr instanceof Error ? userErr.message : "Internal evaluation error",
          });
        }
      }

      skip += users.length;
      if (users.length < BATCH_SIZE) break;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalProcessed,
        spokenCount,
        results,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Companion Nikki Brain] Tick failed:", error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : "Nikki brain tick failed.",
          code: "TICK_FAILED",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Convenience GET alias for cron monitors supporting GET only.
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

