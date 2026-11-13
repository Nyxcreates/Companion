"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Sparkles,
  Moon,
  Clock,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Droplets,
  Coffee,
  CheckCircle2,
  Calendar,
  Heart,
  Volume2,
  VolumeX,
  Layers,
  Activity,
} from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notifications/categories";

interface CompanionNativeInterface {
  isNativeApp?: () => boolean;
  checkFloatingPermission?: () => boolean;
  requestFloatingPermission?: () => void;
  toggleFloatingNikki?: (enable: boolean) => void;
  checkUsageStatsPermission?: () => boolean;
  requestUsageStatsPermission?: () => void;
  toggleAppUsageTracking?: (enable: boolean) => void;
  showToast?: (message: string) => void;
}

const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; description: string; icon: React.ReactNode }
> = {
  task_reminder: {
    label: "Task Reminders",
    description: "Gentle nudges when tasks are approaching or overdue.",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  },
  goal_deadline: {
    label: "Goal Deadlines",
    description: "Milestone alerts for active long-term goals.",
    icon: <Calendar className="h-4 w-4 text-amber-400" />,
  },
  timetable_reminder: {
    label: "Schedule & Timetable",
    description: "Alerts before scheduled events or planned focus blocks.",
    icon: <Clock className="h-4 w-4 text-cyan-400" />,
  },
  focus_reminder: {
    label: "Focus Reminders",
    description: "Suggestions to start planned study/work sessions.",
    icon: <Sparkles className="h-4 w-4 text-purple-400" />,
  },
  break_reminder: {
    label: "Break Reminders",
    description: "Prompts to stretch, rest eyes, or walk after focused work.",
    icon: <Coffee className="h-4 w-4 text-teal-400" />,
  },
  wellbeing_water_food: {
    label: "Hydration & Meals",
    description: "Gentle reminders to drink water and nourish yourself.",
    icon: <Droplets className="h-4 w-4 text-blue-400" />,
  },
  mood_checkin: {
    label: "Mood Check-ins",
    description: "Empathetic check-ins when conversations reflect stress or tiredness.",
    icon: <Heart className="h-4 w-4 text-pink-400" />,
  },
  sleep_reminder: {
    label: "Sleep & Rest",
    description: "Late-night reminders to wind down for healthy rest.",
    icon: <Moon className="h-4 w-4 text-indigo-400" />,
  },
  commitment_reminder: {
    label: "Personal Commitments",
    description: "Protecting fixed classes, family events, or appointments.",
    icon: <Calendar className="h-4 w-4 text-sky-400" />,
  },
  nikki_supportive: {
    label: "Nikki's Encouragements",
    description: "Occasional supportive celebration when you finish tasks.",
    icon: <Sparkles className="h-4 w-4 text-rose-400" />,
  },
};

export function NotificationSettingsSection() {
  const {
    preferences,
    preferencesError,
    refetchPreferences,
    updatePreferences,
    resetLearned,
    requestBrowserPermission,
    browserPermissionStatus,
    isPushSubscribed,
    pushLoading,
    subscribePush,
    unsubscribePush,
    sendTestPush,
  } = useNotifications();

  const [isSaving, setIsSaving] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testPushFeedback, setTestPushFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Native Android bridge detection
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [floatingEnabled, setFloatingEnabled] = useState(false);
  const [usageTrackingEnabled, setUsageTrackingEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const bridge = (window as unknown as { CompanionNative?: CompanionNativeInterface }).CompanionNative;
      if (bridge && typeof bridge.isNativeApp === "function") {
        setIsNativeApp(true);
      }
    }
  }, []);

  if (!preferences) {
    if (preferencesError) {
      return (
        <Card id="notifications" className="p-6 text-center">
          <p className="text-sm text-danger mb-3">{preferencesError}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => refetchPreferences()}
            className="text-xs mx-auto"
          >
            Retry loading notifications
          </Button>
        </Card>
      );
    }
    return (
      <Card id="notifications" className="p-6">
        <p className="text-sm text-ink-muted">Loading notification settings...</p>
      </Card>
    );
  }

  const isPaused = preferences.pausedUntil && new Date(preferences.pausedUntil) > new Date();

  const handleToggleProactive = async () => {
    await updatePreferences({ proactiveEnabled: !preferences.proactiveEnabled });
  };

  const handleToggleCategory = async (cat: NotificationCategory) => {
    const currentCategories = preferences.categoriesEnabled ?? {};
    const isCurrentlyEnabled = currentCategories[cat] !== false;
    const nextCategories = {
      ...currentCategories,
      [cat]: !isCurrentlyEnabled,
    };
    await updatePreferences({ categoriesEnabled: nextCategories });
  };

  const handlePause = async (hours: number | null) => {
    if (hours === null) {
      await updatePreferences({ pausedUntil: null });
    } else {
      const target = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await updatePreferences({ pausedUntil: target });
    }
  };

  const handleResetLearned = async () => {
    setIsSaving(true);
    try {
      await resetLearned();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNativeFloating = () => {
    if (typeof window === "undefined") return;
    try {
      const bridge = (window as unknown as { CompanionNative?: CompanionNativeInterface }).CompanionNative;
      const nextState = !floatingEnabled;
      setFloatingEnabled(nextState);
      if (bridge?.toggleFloatingNikki) {
        bridge.toggleFloatingNikki(nextState);
      }
    } catch (e) {
      console.warn("CompanionNative bridge unavailable", e);
    }
  };

  const handleToggleNativeUsage = () => {
    if (typeof window === "undefined") return;
    try {
      const bridge = (window as unknown as { CompanionNative?: CompanionNativeInterface }).CompanionNative;
      const nextState = !usageTrackingEnabled;
      setUsageTrackingEnabled(nextState);
      if (bridge?.toggleAppUsageTracking) {
        bridge.toggleAppUsageTracking(nextState);
      }
    } catch (e) {
      console.warn("CompanionNative bridge unavailable", e);
    }
  };

  return (
    <Card id="notifications" className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-primary flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-400" />
            Nikki&apos;s Presence &amp; Notifications
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Configure how and when Nikki checks in on you, respects quiet hours, and learns your habits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <span className="flex items-center gap-1 text-xs text-amber-400 font-medium bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
              <VolumeX className="h-3 w-3" />
              Paused
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
              <Volume2 className="h-3 w-3" />
              Active
            </span>
          )}
        </div>
      </div>

      {/* Android Native Features Card */}
      <div className="rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-950/30 to-slate-900/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-ink-primary">
              Android Companion Experience
            </h3>
          </div>
          <span className="rounded-full bg-cyan-400/15 border border-cyan-400/30 px-2 py-0.5 text-[10px] font-mono font-medium text-cyan-300">
            {isNativeApp ? "Active on your device" : "Available on Companion Android"}
          </span>
        </div>

        <p className="text-xs text-ink-muted mb-4 leading-relaxed">
          When using Companion on your Android phone, Nikki can stay by your side outside the app as an interactive floating avatar and offer gentle focus reminders.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Floating Nikki Toggle */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-cyan-300" />
                  Floating Nikki Overlay
                </p>
                <input
                  type="checkbox"
                  checked={floatingEnabled}
                  onChange={handleToggleNativeFloating}
                  className="rounded border-white/20 bg-white/10 text-cyan-400 focus:ring-0"
                />
              </div>
              <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                Draggable avatar on your phone screen while you study or multitask. Tap her anytime to open quick check-ins.
              </p>
            </div>
          </div>

          {/* Phone Balance & Usage Stats Toggle */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-purple-400" />
                  Phone Usage Balance
                </p>
                <input
                  type="checkbox"
                  checked={usageTrackingEnabled}
                  onChange={handleToggleNativeUsage}
                  className="rounded border-white/20 bg-white/10 text-cyan-400 focus:ring-0"
                />
              </div>
              <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                Gently nudges you when continuous scrolling on Instagram or YouTube is detected. 100% processed locally on your phone.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Proactive Presence Toggle & Floating Avatar Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">
              Proactive Messages &amp; Check-Ins
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              Allow Nikki to contextually accompany you throughout the day based on your timetable.
            </p>
          </div>
          <div className="pt-3">
            <Button
              size="sm"
              variant={preferences.proactiveEnabled ? "secondary" : "ghost"}
              onClick={handleToggleProactive}
              className="text-xs w-full justify-center"
            >
              {preferences.proactiveEnabled ? "Proactive Messages: ON" : "Proactive Messages: OFF"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">
              Floating Avatar Presence
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              Show draggable Nikki avatar floating across the companion app.
            </p>
          </div>
          <div className="pt-3 flex gap-2">
            <Button
              size="sm"
              variant={preferences.floatingPresence !== "off" ? "secondary" : "ghost"}
              onClick={() => updatePreferences({ floatingPresence: "always" })}
              className="text-xs flex-1 justify-center"
            >
              Visible
            </Button>
            <Button
              size="sm"
              variant={preferences.floatingPresence === "off" ? "secondary" : "ghost"}
              onClick={() => updatePreferences({ floatingPresence: "off" })}
              className="text-xs flex-1 justify-center"
            >
              Hidden
            </Button>
          </div>
        </div>
      </div>

      {/* Interaction Frequency Selector */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">Interaction Frequency</p>
            <p className="text-xs text-ink-muted mt-0.5">
              Control how often Nikki proactively speaks up or nudges you.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {(["gentle", "balanced", "frequent"] as const).map((freq) => {
            const isActive = (preferences.checkInFrequency || "balanced") === freq;
            const labels = {
              gentle: "Gentle (Minimal)",
              balanced: "Balanced (Recommended)",
              frequent: "Proactive (Frequent)",
            };
            return (
              <Button
                key={freq}
                size="sm"
                variant={isActive ? "secondary" : "ghost"}
                onClick={() => updatePreferences({ checkInFrequency: freq })}
                className="text-xs capitalize"
              >
                {labels[freq]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Nikki Strictness & Tone Selector */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
              <Heart className="h-4 w-4 text-pink-400" />
              Nikki&apos;s Strictness &amp; Accountability
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              Tune Nikki&apos;s tone: gentle reassurance, playful motivation, or direct accountability.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {(["gentle", "playful", "firm"] as const).map((mode) => {
            const isActive = (preferences.strictness || "playful") === mode;
            const meta = {
              gentle: {
                title: "Gentle",
                desc: "Soft, calming, low-pressure warmth and breathing room.",
              },
              playful: {
                title: "Playful",
                desc: "Cheerful, lightly teasing, curious and upbeat companion.",
              },
              firm: {
                title: "Firm",
                desc: "Direct, loving accountability focused on execution.",
              },
            }[mode];
            return (
              <button
                key={mode}
                type="button"
                onClick={() => updatePreferences({ strictness: mode })}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? "border-amber-400/50 bg-amber-400/10 text-white shadow-sm"
                    : "border-white/10 bg-white/[0.03] text-ink-muted hover:border-white/20 hover:text-white"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold">{meta.title}</span>
                  {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />}
                </div>
                <span className="text-[11px] text-ink-muted leading-tight">{meta.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Snooze / Pause Controls */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-cyan-400" />
          Pause Nikki&apos;s Nudges
        </h3>
        <p className="text-xs text-ink-muted">
          Temporarily quiet all check-ins while you sleep or attend an exam.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handlePause(null)}
            className="text-xs"
          >
            Resume All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePause(1)}
            className="text-xs"
          >
            Pause 1 Hour
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePause(3)}
            className="text-xs"
          >
            Pause 3 Hours
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePause(8)}
            className="text-xs"
          >
            Pause 8 Hours
          </Button>
        </div>
      </div>

      {/* Quiet Hours & Intervals Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">
        <div>
          <label className="block text-sm font-medium text-ink-primary mb-1">
            Quiet Hours Start (Evening)
          </label>
          <input
            type="time"
            value={preferences.quietHoursStart ?? "22:00"}
            onChange={(e) =>
              updatePreferences({ quietHoursStart: e.target.value })
            }
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-primary mb-1">
            Quiet Hours End (Morning)
          </label>
          <input
            type="time"
            value={preferences.quietHoursEnd ?? "08:00"}
            onChange={(e) =>
              updatePreferences({ quietHoursEnd: e.target.value })
            }
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-primary mb-1">
            Break Reminder Interval (Minutes)
          </label>
          <input
            type="number"
            min={15}
            max={180}
            step={5}
            value={preferences.breakIntervalMinutes ?? 45}
            onChange={(e) =>
              updatePreferences({ breakIntervalMinutes: Number(e.target.value) })
            }
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-primary mb-1">
            Water Reminder Interval (Minutes)
          </label>
          <input
            type="number"
            min={30}
            max={240}
            step={15}
            value={preferences.waterIntervalMinutes ?? 60}
            onChange={(e) =>
              updatePreferences({ waterIntervalMinutes: Number(e.target.value) })
            }
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-cyan-400" />
                <h4 className="text-sm font-semibold text-white">Real Web Push Notifications</h4>
                {isPushSubscribed ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    Subscribed &amp; Ready
                  </span>
                ) : browserPermissionStatus === "granted" ? (
                  <span className="text-[11px] text-amber-300 font-medium bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
                    Permission Granted
                  </span>
                ) : browserPermissionStatus === "denied" ? (
                  <span className="text-[11px] text-rose-400 font-medium bg-rose-400/10 border border-rose-400/20 px-2.5 py-0.5 rounded-full">
                    Blocked by Browser
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-muted bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full">
                    Permission Needed
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted mt-1 leading-snug">
                Receive Nikki&apos;s check-ins, hydration prompts, and goal reminders even when Companion is completely closed.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {browserPermissionStatus === "unsupported" ? (
                <span className="text-xs text-ink-muted italic">Unsupported in this browser</span>
              ) : !isPushSubscribed ? (
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={pushLoading}
                  onClick={() => requestBrowserPermission()}
                  className="text-xs"
                >
                  {browserPermissionStatus === "granted" ? "Activate Web Push" : "Enable Push Notifications"}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={testingPush}
                    onClick={async () => {
                      setTestingPush(true);
                      setTestPushFeedback(null);
                      try {
                        const res = await sendTestPush();
                        setTestPushFeedback(res);
                        setTimeout(() => setTestPushFeedback(null), 5000);
                      } finally {
                        setTestingPush(false);
                      }
                    }}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Send Test Push</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isLoading={pushLoading}
                    onClick={() => unsubscribePush()}
                    className="text-xs text-ink-muted hover:text-rose-400"
                  >
                    Unsubscribe
                  </Button>
                </div>
              )}
            </div>
          </div>

          {testPushFeedback && (
            <div
              className={`rounded-lg p-2.5 text-xs flex items-center gap-2 ${
                testPushFeedback.success
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
              }`}
            >
              {testPushFeedback.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              )}
              <span>{testPushFeedback.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notification Categories Toggles */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-primary">Notification Categories</h3>
        <p className="text-xs text-ink-muted">
          Choose which types of notifications Nikki can send you.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {NOTIFICATION_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const isEnabled = preferences.categoriesEnabled
              ? preferences.categoriesEnabled[cat] !== false
              : true;

            return (
              <div
                key={cat}
                onClick={() => handleToggleCategory(cat)}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${isEnabled
                    ? "border-white/15 bg-white/[0.04] hover:bg-white/[0.08]"
                    : "border-white/5 bg-transparent opacity-60 hover:opacity-80"
                  }`}
              >
                <div className="mt-0.5 shrink-0 rounded-lg bg-white/10 p-1.5">
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">{meta.label}</p>
                    <span
                      className={`h-2 w-2 rounded-full ${isEnabled ? "bg-emerald-400" : "bg-slate-600"
                        }`}
                    />
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">
                    {meta.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Learned Habits & Reset Section */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Learned Preferences</p>
          <p className="text-xs text-ink-muted mt-0.5 max-w-md">
            Nikki quietly adapts reminder frequency based on which suggestions you accept or dismiss.
            {preferences.learnedWeights?.preferredBreakActivity && (
              <span className="text-cyan-300 block mt-1">
                Preferred break type: &ldquo;{preferences.learnedWeights.preferredBreakActivity}&rdquo;
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {resetSuccess && (
            <span className="text-xs text-emerald-400 font-medium">Reset complete!</span>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={handleResetLearned}
            isLoading={isSaving}
            className="flex items-center gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Learned Habits</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
