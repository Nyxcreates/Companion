"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  ShieldCheck,
  Play,
  Square,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useUsage } from "@/context/UsageContext";
import { useNotifications } from "@/context/NotificationContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function PhoneUsageWidget() {
  const {
    stats,
    isDistractionTimerRunning,
    distractionTimerSeconds,
    startDistractionTimer,
    stopDistractionTimer,
  } = useUsage();

  const { preferences, updatePreferences } = useNotifications();

  const [showAndroidArchModal, setShowAndroidArchModal] = useState(false);
  const [goalInput, setGoalInput] = useState<number>(
    preferences?.dailyPhoneGoalMinutes ?? stats.dailyGoalMinutes ?? 120
  );
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const handleSaveGoal = async () => {
    setIsSavingGoal(true);
    try {
      await updatePreferences({ dailyPhoneGoalMinutes: Number(goalInput) });
    } finally {
      setIsSavingGoal(false);
    }
  };

  const appMinutes = stats.appActiveMinutes;
  const distractionFreeMins = stats.distractionFreeMinutes;
  const goalMins = preferences?.dailyPhoneGoalMinutes ?? stats.dailyGoalMinutes ?? 120;
  const progressPercent = Math.min(100, Math.round((distractionFreeMins / Math.max(1, goalMins)) * 100));

  return (
    <Card className="flex flex-col gap-5 p-5 md:p-6 bg-slate-900/40 border-white/10 backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-400/20 text-purple-400">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Phone Usage & Distraction Awareness
            </h3>
            <p className="text-xs text-ink-muted">
              Mindful digital balance with Nikki&apos;s support
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAndroidArchModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-ink-muted hover:text-white hover:bg-white/10 transition-colors self-start sm:self-auto"
        >
          <Info className="h-3.5 w-3.5 text-cyan-400" />
          <span>Stage B Android Architecture</span>
        </button>
      </div>

      {/* Honest Web Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-3 text-xs text-cyan-200">
        <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-cyan-300">Stage A Web Mode: </span>
          Web browsers run in a secure sandbox and cannot monitor other apps (like Instagram or YouTube) on your phone when closed. Use the Distraction-Free Timer below to track intentional time away from your phone.
        </div>
      </div>

      {/* Interactive Distraction-Free Phone Timer */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Phone-Away Timer</span>
            {isDistractionTimerRunning && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Put your phone face-down and focus on life or study.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isDistractionTimerRunning && (
            <div className="font-mono text-2xl font-bold text-white tracking-wider px-3 py-1 rounded-xl bg-white/10 border border-white/15">
              {formatSeconds(distractionTimerSeconds)}
            </div>
          )}

          {isDistractionTimerRunning ? (
            <Button
              variant="danger"
              size="sm"
              onClick={stopDistractionTimer}
              className="flex items-center gap-1.5"
            >
              <Square className="h-4 w-4" />
              <span>Finish Session</span>
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={startDistractionTimer}
              className="flex items-center gap-1.5"
            >
              <Play className="h-4 w-4" />
              <span>Start Phone-Free Time</span>
            </Button>
          )}
        </div>
      </div>

      {/* Daily Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center sm:text-left">
          <p className="text-[11px] text-ink-muted font-medium uppercase tracking-wider">Today&apos;s Active In Companion</p>
          <p className="text-xl font-bold font-display text-white mt-1">{appMinutes}m</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center sm:text-left">
          <p className="text-[11px] text-ink-muted font-medium uppercase tracking-wider">Distraction-Free Time</p>
          <p className="text-xl font-bold font-display text-emerald-400 mt-1">{distractionFreeMins}m</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center sm:text-left">
          <p className="text-[11px] text-ink-muted font-medium uppercase tracking-wider">Goal Progress</p>
          <p className="text-xl font-bold font-display text-cyan-300 mt-1">{progressPercent}%</p>
        </div>
      </div>

      {/* Daily Goal Configuration */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs">
        <label htmlFor="goal-input" className="text-ink-secondary">
          Daily Phone-Free / Focus Goal (Minutes):
        </label>
        <div className="flex items-center gap-2">
          <input
            id="goal-input"
            type="number"
            min={15}
            max={720}
            step={15}
            value={goalInput}
            onChange={(e) => setGoalInput(Number(e.target.value))}
            className="w-24 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-center font-mono text-sm text-white focus:border-cyan-400 focus:outline-none"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSaveGoal}
            isLoading={isSavingGoal}
            className="text-xs py-1"
          >
            Save Goal
          </Button>
        </div>
      </div>

      {/* Stage B Android Architecture Modal */}
      <AnimatePresence>
        {showAndroidArchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-xl w-full rounded-2xl border border-white/20 bg-slate-900 p-6 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2 text-white font-semibold font-display text-lg">
                  <Smartphone className="h-5 w-5 text-cyan-400" />
                  <span>Stage B — Native Android Architecture</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAndroidArchModal(false)}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs text-ink-secondary leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                <p>
                  To reliably monitor cross-application usage (e.g. YouTube, Instagram, TikTok) when Companion is in the background or screen is off, a native Android companion service is required.
                </p>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-2">
                  <h4 className="font-semibold text-white text-sm">Security & Privacy Protocol:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>Explicit user prompt requesting <code className="text-cyan-300 bg-white/10 px-1 rounded">PACKAGE_USAGE_STATS</code> (Usage Access).</li>
                    <li>Read-only foreground app duration via <code className="text-cyan-300 bg-white/10 px-1 rounded">UsageStatsManager.queryUsageStats()</code>.</li>
                    <li>Zero collection of passwords, keystrokes, messages, or screen contents.</li>
                    <li>User can whitelist or exclude sensitive apps (e.g., banking, health).</li>
                    <li>On-device evaluation; only aggregated bucket minutes are synced to Companion backend.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-2">
                  <h4 className="font-semibold text-white text-sm">Target Android Service Components:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li><strong>UsageWorker:</strong> Periodic background worker checking daily limit thresholds.</li>
                    <li><strong>ProactiveNotificationService:</strong> Dispatches gentle Nikki check-ins via Android NotificationChannels.</li>
                    <li><strong>CompanionSyncAdapter:</strong> Secure mutual auth with Companion REST API.</li>
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => setShowAndroidArchModal(false)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Card>
  );
}

