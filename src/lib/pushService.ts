import { setVapidDetails, sendNotification } from "web-push";
import { connectToDatabase } from "@/lib/mongodb";
import { PushSubscriptionModel } from "@/models/PushSubscription";
import { NotificationPreferenceModel } from "@/models/NotificationPreference";
import type { NotificationCategory } from "@/lib/notifications/categories";

/** Returns true if the current time (in the given IANA timezone) is within quiet hours. */
function isWithinQuietHours(
  quietStart: string | undefined | null,
  quietEnd: string | undefined | null,
  timezone: string | undefined | null
): boolean {
  if (!quietStart || !quietEnd) return false;

  try {
    const tz = timezone || "UTC";
    const now = new Date();

    // Get current HH:MM in user's timezone
    const localTime = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(now);

    const [nowH, nowM] = localTime.split(":").map(Number);
    const nowMins = nowH * 60 + nowM;

    const [startH, startM] = quietStart.split(":").map(Number);
    const startMins = startH * 60 + startM;

    const [endH, endM] = quietEnd.split(":").map(Number);
    const endMins = endH * 60 + endM;

    if (startMins <= endMins) {
      // e.g. 09:00–17:00 (same day)
      return nowMins >= startMins && nowMins < endMins;
    } else {
      // Overnight window, e.g. 22:00–07:00
      return nowMins >= startMins || nowMins < endMins;
    }
  } catch {
    return false;
  }
}

export interface SendPushOptions {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
  category?: NotificationCategory;
  actions?: Array<{ action: string; title: string }>;
  data?: Record<string, unknown>;
  /** IANA timezone of the user (e.g. "Asia/Kolkata"). Used for quiet-hours enforcement. */
  userTimezone?: string;
  /** Set to true to bypass quiet hours (e.g. for test pushes or critical alerts). */
  bypassQuietHours?: boolean;
}

export interface PushDeliveryResult {
  success: boolean;
  reason?: string;
  sentCount: number;
  removedCount: number;
  totalSubscriptions?: number;
}

let vapidConfigured = false;

export function getVapidPublicKey(): string {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    console.warn(
      "[Companion pushService] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set. " +
      "Generate keys with: npx web-push generate-vapid-keys"
    );
  }
  return key || "";
}

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:companion@app.internal";

  if (publicKey && privateKey) {
    try {
      setVapidDetails(subject, publicKey, privateKey);
      vapidConfigured = true;
      return true;
    } catch (err) {
      console.error("[Companion pushService] Failed to set VAPID details:", err);
      return false;
    }
  }

  console.warn(
    "[Companion pushService] VAPID keys not configured in environment. Push notifications disabled."
  );
  return false;
}

/**
 * Sends a web push notification to all active devices subscribed for a given user.
 * Automatically checks user preferences and cleans up expired or unsubscribed endpoints (HTTP 404/410).
 */
export async function sendPushToUser(
  firebaseUid: string,
  options: SendPushOptions
): Promise<PushDeliveryResult> {
  if (!ensureVapidConfigured()) {
    return {
      success: false,
      reason: "VAPID_NOT_CONFIGURED",
      sentCount: 0,
      removedCount: 0,
    };
  }

  await connectToDatabase();

  // 1. Verify User Preferences (proactiveEnabled, pause, category opt-outs)
  const prefs = await NotificationPreferenceModel.findOne({ firebaseUid });
  if (prefs) {
    if (prefs.proactiveEnabled === false) {
      return {
        success: false,
        reason: "PROACTIVE_DISABLED",
        sentCount: 0,
        removedCount: 0,
      };
    }

    if (prefs.pausedUntil && new Date(prefs.pausedUntil) > new Date()) {
      return {
        success: false,
        reason: "NOTIFICATIONS_PAUSED",
        sentCount: 0,
        removedCount: 0,
      };
    }

    // Check quiet hours using user's timezone (passed in options or default UTC)
    if (
      !options.bypassQuietHours &&
      isWithinQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd, options.userTimezone || "UTC")
    ) {
      return {
        success: false,
        reason: `QUIET_HOURS: ${prefs.quietHoursStart ?? "22:30"} – ${prefs.quietHoursEnd ?? "07:00"}`,
        sentCount: 0,
        removedCount: 0,
      };
    }

    if (options.category && prefs.categoriesEnabled) {
      const isEnabled = prefs.categoriesEnabled instanceof Map
        ? prefs.categoriesEnabled.get(options.category) !== false
        : (prefs.categoriesEnabled as Record<string, boolean>)[options.category] !== false;

      if (!isEnabled) {
        return {
          success: false,
          reason: `CATEGORY_DISABLED: ${options.category}`,
          sentCount: 0,
          removedCount: 0,
        };
      }
    }
  }

  // 2. Fetch all push subscriptions for this user
  const subs = await PushSubscriptionModel.find({ firebaseUid });
  if (!subs || subs.length === 0) {
    return {
      success: true,
      reason: "NO_ACTIVE_SUBSCRIPTIONS",
      sentCount: 0,
      removedCount: 0,
      totalSubscriptions: 0,
    };
  }

  const payloadString = JSON.stringify({
    title: options.title || "Nikki",
    body: options.body,
    url: options.url || "/dashboard",
    icon: options.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: options.tag || `companion-${Date.now()}`,
    actions: options.actions || [
      { action: "open", title: "Open Companion" },
      { action: "dismiss", title: "Later" },
    ],
    data: {
      url: options.url || "/dashboard",
      dateOfArrival: Date.now(),
      ...options.data,
    },
  });

  let sentCount = 0;
  let removedCount = 0;

  await Promise.all(
    subs.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      try {
        await sendNotification(pushSubscription, payloadString);
        sentCount++;
      } catch (err: unknown) {
        const error = err as { statusCode?: number; message?: string };
        const statusCode = error?.statusCode;

        // 404 (Not Found) or 410 (Gone) indicate the subscription is no longer valid
        if (statusCode === 404 || statusCode === 410) {
          console.log(`[Companion pushService] Pruning expired subscription: ${sub.endpoint}`);
          await PushSubscriptionModel.deleteOne({ _id: sub._id });
          removedCount++;
        } else {
          console.warn(
            `[Companion pushService] Failed delivery to ${sub.endpoint.slice(0, 45)}...:`,
            error?.message || err
          );
        }
      }
    })
  );

  return {
    success: sentCount > 0,
    sentCount,
    removedCount,
    totalSubscriptions: subs.length,
  };
}
