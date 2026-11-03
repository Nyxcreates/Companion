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
  activeCheckIn: CheckInTrigger | null;
  isLoading: boolean;
  browserPermissionStatus: NotificationPermission | "unsupported";
  fetchNotifications: () => Promise<void>;
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
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [activeCheckIn, setActiveCheckIn] = useState<CheckInTrigger | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [browserPermissionStatus, setBrowserPermissionStatus] = useState<
    NotificationPermission | "unsupported"
  >("default");

  const lastEvaluatedAtRef = useRef<number>(0);

  // Check browser notification permission support
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPermissionStatus(Notification.permission);
    } else {
      setBrowserPermissionStatus("unsupported");
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const res = await authFetch("/api/notifications/preferences");
      const envelope = await parseApiResponse<NotificationPreferences>(res);
      if (res.ok && envelope.data) {
        setPreferences(envelope.data);
      }
    } catch {
      // Best-effort
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

  const requestBrowserPermission = async (): Promise<NotificationPermission | "unsupported"> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPermissionStatus(permission);

      if (permission === "granted" && "serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js");
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await authFetch("/api/notifications/push", {
              method: "POST",
              body: JSON.stringify(sub),
            });
          }
        } catch {
          // SW registration or push subscription not available in this environment
        }
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
        activeCheckIn,
        isLoading,
        browserPermissionStatus,
        fetchNotifications,
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
