"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useReducedMotion } from "framer-motion";

interface WorldSchedulerOptions {
  minIntervalSeconds?: number;
  maxIntervalSeconds?: number;
  momentDurationMs?: number;
  disabled?: boolean;
}

export interface WorldSchedulerState {
  isTabVisible: boolean;
  isMobile: boolean;
  isMomentActive: boolean;
  momentCount: number;
  prefersReducedMotion: boolean;
}

/**
 * Manages environmental animation scheduling for living worlds:
 * 1. Pauses processing when tab is hidden (document.visibilityState === "hidden").
 * 2. Detects mobile viewports to cap particle counts.
 * 3. Schedules random rare "moments" every 20–60 seconds.
 * 4. Respects prefers-reduced-motion.
 */
export function useWorldScheduler({
  minIntervalSeconds = 20,
  maxIntervalSeconds = 60,
  momentDurationMs = 5000,
  disabled = false,
}: WorldSchedulerOptions = {}): WorldSchedulerState {
  const prefersReducedMotion = Boolean(useReducedMotion());

  const [isTabVisible, setIsTabVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState !== "hidden";
  });

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });

  const [isMomentActive, setIsMomentActive] = useState(false);
  const [momentCount, setMomentCount] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor tab visibility
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibility = () => {
      const visible = document.visibilityState !== "hidden";
      setIsTabVisible(visible);
      if (!visible) {
        setIsMomentActive(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Monitor resize for mobile particle cap
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Schedule next rare moment
  const scheduleNextMoment = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    if (disabled || prefersReducedMotion || !isTabVisible) {
      return;
    }

    const intervalSec =
      minIntervalSeconds + Math.random() * (maxIntervalSeconds - minIntervalSeconds);
    const delayMs = intervalSec * 1000;

    timerRef.current = setTimeout(() => {
      setIsMomentActive(true);
      setMomentCount((prev) => prev + 1);

      resetTimerRef.current = setTimeout(() => {
        setIsMomentActive(false);
        scheduleNextMoment();
      }, momentDurationMs);
    }, delayMs);
  }, [disabled, prefersReducedMotion, isTabVisible, minIntervalSeconds, maxIntervalSeconds, momentDurationMs]);

  useEffect(() => {
    scheduleNextMoment();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [scheduleNextMoment]);

  return {
    isTabVisible,
    isMobile,
    isMomentActive,
    momentCount,
    prefersReducedMotion,
  };
}

