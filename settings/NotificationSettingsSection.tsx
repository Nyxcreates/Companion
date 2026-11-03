"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/models/Notification";

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
    updatePreferences,
    resetLearned,
    requestBrowserPermission,
    browserPermissionStatus,
  } = useNotifications();

  const [isSaving, setIsSaving] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!preferences) {
    return null;
  }

  const isPaused = preferences.pausedUntil && new Date(preferences.pausedUntil) > new Date();

  const handleToggleProactive = async () => {
    await updatePreferences({ proactiveEnabled: !preferences.proactiveEnabled });
  };

  const handleToggleCategory = async (cat: NotificationCategory) => {
    const nextCategories = {
      ...preferences.categoriesEnabled,
      [cat]: !preferences.categoriesEnabled[cat],
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

  return (
    <Card id="notifications" className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-primary">
            Nikki&apos;s Presence & Notifications
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

      {/* Main Proactive Check-in Toggle */}
      <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 p-4">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Proactive Check-ins</p>
          <p className="text-xs text-ink-muted mt-0.5">
            Allow Nikki to occasionally initiate supportive interactions based on your work and day.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleProactive}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            preferences.proactiveEnabled ? "bg-cyan-500" : "bg-slate-700"
          }`}
          role="switch"
          aria-checked={preferences.proactiveEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              preferences.proactiveEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Floating Appearance Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-sm font-medium text-ink-primary">Nikki&apos;s Floating Presence</p>
          <p className="text-xs text-ink-muted">
            Display Nikki as a small floating companion in the corner of your screen.
          </p>
        </div>
        <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-1 text-xs">
          {(["always", "subtle", "off"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updatePreferences({ floatingPresence: mode })}
              className={`rounded-lg px-3 py-1 font-medium capitalize transition-colors ${
                preferences.floatingPresence === mode
                  ? "bg-cyan-500 text-slate-950 shadow"
                  : "text-ink-muted hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Pause Proactive Check-ins */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <p className="text-sm font-medium text-ink-primary">Pause All Check-ins Temporarily</p>
          <p className="text-xs text-ink-muted">
            Need uninterrupted quiet time right now?
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button size="sm" variant="primary" onClick={() => handlePause(null)}>
              Resume Check-ins
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => handlePause(1)} className="text-xs">
                Pause 1h
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handlePause(4)} className="text-xs">
                Pause 4h
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handlePause(24)} className="text-xs">
                Today
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-sm font-medium text-ink-primary">Quiet Hours</p>
          <p className="text-xs text-ink-muted">
            During quiet hours, Nikki suppresses non-urgent reminders and check-ins.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-ink-muted">From</label>
          <input
            type="time"
            value={preferences.quietHoursStart ?? "22:30"}
            onChange={(e) => updatePreferences({ quietHoursStart: e.target.value })}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-white focus:border-cyan-400 focus:outline-none"
          />
          <label className="text-ink-muted">To</label>
          <input
            type="time"
            value={preferences.quietHoursEnd ?? "07:00"}
            onChange={(e) => updatePreferences({ quietHoursEnd: e.target.value })}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-white focus:border-cyan-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Check-in Frequency & Intervals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-white/10 pb-4">
        <div>
          <label className="block text-sm font-medium text-ink-primary mb-1">
            Check-in Frequency
          </label>
          <select
            value={preferences.checkInFrequency}
            onChange={(e) =>
              updatePreferences({ checkInFrequency: e.target.value as any })
            }
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            <option value="gentle">Gentle (Every ~2 hours)</option>
            <option value="balanced">Balanced (Every ~1 hour)</option>
            <option value="frequent">Frequent (Every ~30 minutes)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-primary mb-1">
            Break Reminder (Minutes of Focus)
          </label>
          <input
            type="number"
            min={15}
            max={180}
            step={5}
            value={preferences.breakIntervalMinutes}
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
            value={preferences.waterIntervalMinutes}
            onChange={(e) =>
              updatePreferences({ waterIntervalMinutes: Number(e.target.value) })
            }
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-primary mb-1">
            Browser Notifications
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={browserPermissionStatus === "granted" ? "ghost" : "secondary"}
              onClick={() => requestBrowserPermission()}
              className="text-xs"
            >
              {browserPermissionStatus === "granted"
                ? "✓ Push Enabled"
                : browserPermissionStatus === "denied"
                ? "Blocked in Browser"
                : "Enable Browser Notifications"}
            </Button>
          </div>
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
            const isEnabled = preferences.categoriesEnabled[cat] !== false;

            return (
              <div
                key={cat}
                onClick={() => handleToggleCategory(cat)}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  isEnabled
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
                      className={`h-2 w-2 rounded-full ${
                        isEnabled ? "bg-emerald-400" : "bg-slate-600"
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

