"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { authFetch } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useAuth } from "./AuthContext";
import type {
  NotificationItem,
  NotificationPreferences,
  CheckInTrigger,
} from "@/types/notification";

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  preferencesError: string | null;
  activeCheckIn: CheckInTrigger | null;
  isLoading: boolean;
  browserPermissionStatus: NotificationPermission | "unsupported";
  isPushSubscribed: boolean;
  pushLoading: boolean;
  fetchNotifications: () => Promise<void>;
  refetchPreferences: () => Promise<void>;
  evaluateCheckIns: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  snoozeNotification: (id: string, minutes?: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
  resetLearned: () => Promise<void>;
  respondToCheckIn: (
    action: "accept" | "dismiss" | "snooze" | "talk",
    interventionType?: string
  ) => Promise<void>;
  dismissCheckIn: () => void;
  requestBrowserPermission: () => Promise<NotificationPermission | "unsupported">;
  subscribePush: () => Promise<boolean>;
  unsubscribePush: () => Promise<boolean>;
  sendTestPush: () => Promise<{ success: boolean; message: string }>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [activeCheckIn, setActiveCheckIn] = useState<CheckInTrigger | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [browserPermissionStatus, setBrowserPermissionStatus] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const lastEvaluatedAtRef = useRef<number>(0);

  // Check browser notification permission support — must run in useEffect (never at render time).
  // Always access via window.Notification to avoid "Notification is not defined" on SSR/prerender.
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPermissionStatus(window.Notification.permission);
    } else {
      setBrowserPermissionStatus("unsupported");
    }
  }, []);

  // Check if current browser already has an active Web Push subscription
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setIsPushSubscribed(Boolean(sub));
      })
      .catch(() => {});
  }, [firebaseUser]);

  const fetchPreferences = useCallback(async () => {
    if (!firebaseUser) return;
    setPreferencesError(null);
    try {
      const res = await authFetch("/api/notifications/preferences");
      const envelope = await parseApiResponse<NotificationPreferences>(res);
      if (res.ok && envelope.data) {
        setPreferences(envelope.data);
      } else {
        setPreferencesError(envelope.error?.message ?? "Could not load notification preferences.");
      }
    } catch (err) {
      setPreferencesError(err instanceof Error ? err.message : "Failed to load notification settings.");
    }
  }, [firebaseUser]);

  const fetchNotifications = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const res = await authFetch("/api/notifications");
      const envelope = await parseApiResponse<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>(res);
      if (res.ok && envelope.data) {
        setNotifications(envelope.data.notifications);
        setUnreadCount(envelope.data.unreadCount);
      }
    } catch {
      // Best-effort
    }
  }, [firebaseUser]);

  const evaluateCheckIns = useCallback(async () => {
    if (!firebaseUser) return;
    const now = Date.now();
    // Throttle evaluation to at most once every 60 seconds unless triggered explicitly
    if (now - lastEvaluatedAtRef.current < 60000) return;
    lastEvaluatedAtRef.current = now;

    try {
      const tz = getBrowserTimezone();
      const res = await authFetch("/api/notifications/evaluate", {
        method: "POST",
        body: JSON.stringify({ timezone: tz }),
      });
      const envelope = await parseApiResponse<{
        newNotificationsCount: number;
        activeCheckIn: CheckInTrigger | null;
        notifications: NotificationItem[];
        unreadCount: number;
      }>(res);

      if (res.ok && envelope.data) {
        setNotifications(envelope.data.notifications);
        setUnreadCount(envelope.data.unreadCount);
        if (envelope.data.activeCheckIn) {
          setActiveCheckIn(envelope.data.activeCheckIn);
        }
      }
    } catch {
      // Best-effort
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (firebaseUser) {
      setIsLoading(true);
      Promise.all([fetchPreferences(), fetchNotifications()])
        .then(() => evaluateCheckIns())
        .finally(() => setIsLoading(false));

      // Periodic check-in / evaluation loop every 3 minutes while app is active
      const interval = setInterval(() => {
        evaluateCheckIns();
      }, 3 * 60 * 1000);

      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setPreferences(null);
      setActiveCheckIn(null);
    }
  }, [firebaseUser, fetchPreferences, fetchNotifications, evaluateCheckIns]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await authFetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ action: "read", notificationId: id }),
      });
    } catch {
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await authFetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ action: "mark_all_read" }),
      });
    } catch {
      fetchNotifications();
    }
  };

  const dismissNotification = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (target && !target.read) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await authFetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ action: "dismiss", notificationId: id }),
      });
    } catch {
      fetchNotifications();
    }
  };

  const snoozeNotification = async (id: string, minutes = 30) => {
    const target = notifications.find((n) => n.id === id);
    if (target && !target.read) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await authFetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ action: "snooze", notificationId: id, minutes }),
      });
    } catch {
      fetchNotifications();
    }
  };

  const clearHistory = async () => {
    setNotifications([]);
    setUnreadCount(0);
    try {
      await authFetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ action: "clear_history" }),
      });
    } catch {
      fetchNotifications();
    }
  };

  const updatePrefs = async (updates: Partial<NotificationPreferences>) => {
    setPreferences((prev) => (prev ? { ...prev, ...updates } : null));
    try {
      const res = await authFetch("/api/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      const envelope = await parseApiResponse<NotificationPreferences>(res);
      if (res.ok && envelope.data) {
        setPreferences(envelope.data);
      }
    } catch {
      fetchPreferences();
    }
  };

  const resetLearned = async () => {
    try {
      const res = await authFetch("/api/notifications/preferences", {
        method: "POST",
      });
      const envelope = await parseApiResponse<NotificationPreferences>(res);
      if (res.ok && envelope.data) {
        setPreferences(envelope.data);
      }
    } catch {
      fetchPreferences();
    }
  };

  const respondToCheckIn = async (
    action: "accept" | "dismiss" | "snooze" | "talk",
    interventionType?: string
  ) => {
    if (!activeCheckIn) return;
    const current = activeCheckIn;
    setActiveCheckIn(null);

    try {
      await authFetch("/api/notifications/checkin", {
        method: "POST",
        body: JSON.stringify({
          triggerType: current.triggerType,
          message: current.message,
          action,
          interventionType: interventionType ?? current.interventionType,
        }),
      });
    } catch {
      // Best-effort
    }
  };

  const dismissCheckIn = () => {
    if (activeCheckIn) {
      respondToCheckIn("dismiss");
    }
  };

  const subscribePush = async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        // 1. Fetch public VAPID key dynamically from server
        const res = await authFetch("/api/notifications/push");
        const envelope = await parseApiResponse<{ publicKey: string; isConfigured: boolean }>(res);
        const publicKey = envelope.data?.publicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) {
          console.warn("[NotificationContext] No VAPID public key available to subscribe.");
          return false;
        }

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        });
      }

      if (sub) {
        const subJson = sub.toJSON ? sub.toJSON() : sub;
        await authFetch("/api/notifications/push", {
          method: "POST",
          body: JSON.stringify(subJson),
        });
        setIsPushSubscribed(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[NotificationContext] Push subscription error:", err);
      return false;
    } finally {
      setPushLoading(false);
    }
  };

  const unsubscribePush = async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return false;
    }

    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await authFetch(`/api/notifications/push?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
        });
      }
      setIsPushSubscribed(false);
      return true;
    } catch (err) {
      console.error("[NotificationContext] Push unsubscribe error:", err);
      return false;
    } finally {
      setPushLoading(false);
    }
  };

  const sendTestPush = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await authFetch("/api/notifications/push/test", {
        method: "POST",
        body: JSON.stringify({
          title: "Nikki ✨",
          body: "Hey! Just confirming that my check-ins can reach you even when Companion is closed.",
          url: "/dashboard",
        }),
      });
      const envelope = await parseApiResponse<{
        success: boolean;
        sentCount: number;
        reason?: string;
      }>(res);

      if (res.ok && envelope.data?.success) {
        return {
          success: true,
          message: `Test check-in sent successfully to ${envelope.data.sentCount} active device(s)!`,
        };
      }
      return {
        success: false,
        message:
          envelope.data?.reason ||
          envelope.error?.message ||
          "Delivery failed. Check that notifications are allowed on your device.",
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Test push delivery request failed.",
      };
    }
  };

  const requestBrowserPermission = async (): Promise<NotificationPermission | "unsupported"> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    try {
      const permission = await window.Notification.requestPermission();
      setBrowserPermissionStatus(permission);

      if (permission === "granted") {
        await subscribePush();
      }
      return permission;
    } catch {
      return "denied";
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        preferencesError,
        activeCheckIn,
        isLoading,
        browserPermissionStatus,
        isPushSubscribed,
        pushLoading,
        fetchNotifications,
        refetchPreferences: fetchPreferences,
        evaluateCheckIns,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        snoozeNotification,
        clearHistory,
        updatePreferences: updatePrefs,
        resetLearned,
        respondToCheckIn,
        dismissCheckIn,
        requestBrowserPermission,
        subscribePush,
        unsubscribePush,
        sendTestPush,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
