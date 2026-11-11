import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, ApiAuthError } from "@/lib/api/requireUser";
import { connectToDatabase } from "@/lib/mongodb";
import { PushSubscriptionModel } from "@/models/PushSubscription";
import { getVapidPublicKey } from "@/lib/pushService";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const publicKey = getVapidPublicKey();

    // Optionally check if the user is authenticated and has existing active subscriptions
    let hasActiveSubscription = false;
    let subscriptionCount = 0;

    try {
      const user = await requireAuthenticatedUser(request);
      if (user) {
        await connectToDatabase();
        subscriptionCount = await PushSubscriptionModel.countDocuments({ firebaseUid: user.uid });
        hasActiveSubscription = subscriptionCount > 0;
      }
    } catch {
      // Unauthenticated callers still receive the public key to check push readiness
    }

    return NextResponse.json({
      data: {
        publicKey,
        isConfigured: Boolean(publicKey),
        hasActiveSubscription,
        subscriptionCount,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve push status.";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null);

    if (!body || !body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: { message: "Invalid push subscription object.", code: "VALIDATION_ERROR" } },
        { status: 400 }
      );
    }

    await connectToDatabase();
    await PushSubscriptionModel.findOneAndUpdate(
      { firebaseUid: user.uid, endpoint: body.endpoint },
      {
        $set: {
          keys: body.keys,
          expirationTime: body.expirationTime ?? null,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ data: { subscribed: true } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Push subscription failed.";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");

    await connectToDatabase();
    if (endpoint) {
      await PushSubscriptionModel.deleteOne({ firebaseUid: user.uid, endpoint });
    } else {
      await PushSubscriptionModel.deleteMany({ firebaseUid: user.uid });
    }

    return NextResponse.json({ data: { unsubscribed: true } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Push unsubscription failed.";
    return NextResponse.json({ error: { message, code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

