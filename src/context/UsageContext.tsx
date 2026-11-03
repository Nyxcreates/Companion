"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { authFetch } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useAuth } from "./AuthContext";

interface UsageStats {
  appActiveMinutes: number;
  distractionFreeMinutes: number;
  dailyGoalMinutes: number;
}

interface UsageContextValue {
  stats: UsageStats;
  isDistractionTimerRunning: boolean;
  distractionTimerSeconds: number;
  isUserInactive: boolean;
  startDistractionTimer: () => void;
  stopDistractionTimer: () => Promise<void>;
  resetInactivityAlert: () => void;
  refreshStats: () => Promise<void>;
}

const UsageContext = createContext<UsageContextValue | null>(null);

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();

  const [stats, setStats] = useState<UsageStats>({
    appActiveMinutes: 0,
    distractionFreeMinutes: 0,
    dailyGoalMinutes: 120,
  });

  const [isDistractionTimerRunning, setIsDistractionTimerRunning] = useState(false);
  const [distractionTimerSeconds, setDistractionTimerSeconds] = useState(0);
  const [isUserInactive, setIsUserInactive] = useState(false);

  const activeAppSecondsRef = useRef(0);
  const lastActiveTimestampRef = useRef(Date.now());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshStats = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const res = await authFetch("/api/usage");
      const envelope = await parseApiResponse<UsageStats>(res);
      if (res.ok && envelope.data) {
        setStats(envelope.data);
      }
    } catch {
      // Best-effort
    }
  }, [firebaseUser]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Track user activity & detect inactivity (> 15 minutes)
  useEffect(() => {
    const handleActivity = () => {
      lastActiveTimestampRef.current = Date.now();
      if (isUserInactive) {
        setIsUserInactive(false);
      }
    };

    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });

    // Inactivity checker every 30s
    const inactivityInterval = setInterval(() => {
      const elapsed = Date.now() - lastActiveTimestampRef.current;
      if (elapsed > 15 * 60 * 1000 && !isUserInactive) {
        setIsUserInactive(true);
      }
    }, 30000);

    // Active usage accumulator (only counts when document is visible)
    const usageInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        activeAppSecondsRef.current += 5;
        // Every 5 minutes, flush active seconds to backend
        if (activeAppSecondsRef.current >= 300 && firebaseUser) {
          const duration = activeAppSecondsRef.current;
          activeAppSecondsRef.current = 0;
          authFetch("/api/usage", {
            method: "POST",
            body: JSON.stringify({ type: "app_active", durationSeconds: duration }),
          }).catch(() => { });
        }
      }
    }, 5000);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      clearInterval(inactivityInterval);
      clearInterval(usageInterval);
    };
  }, [isUserInactive, firebaseUser]);

  // Distraction-free phone timer runner
  useEffect(() => {
    if (isDistractionTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setDistractionTimerSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isDistractionTimerRunning]);

  const startDistractionTimer = () => {
    setIsDistractionTimerRunning(true);
  };

  const stopDistractionTimer = async () => {
    setIsDistractionTimerRunning(false);
    const duration = distractionTimerSeconds;
    setDistractionTimerSeconds(0);

    if (duration >= 30 && firebaseUser) {
      try {
        await authFetch("/api/usage", {
          method: "POST",
          body: JSON.stringify({
            type: "distraction_free",
            durationSeconds: duration,
          }),
        });
        refreshStats();
      } catch {
        // Best-effort
      }
    }
  };

  const resetInactivityAlert = () => {
    lastActiveTimestampRef.current = Date.now();
    setIsUserInactive(false);
  };

  return (
    <UsageContext.Provider
      value={{
        stats,
        isDistractionTimerRunning,
        distractionTimerSeconds,
        isUserInactive,
        startDistractionTimer,
        stopDistractionTimer,
        resetInactivityAlert,
        refreshStats,
      }}
    >
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage() {
  const ctx = useContext(UsageContext);
  if (!ctx) {
    throw new Error("useUsage must be used within a UsageProvider");
  }
  return ctx;
}
