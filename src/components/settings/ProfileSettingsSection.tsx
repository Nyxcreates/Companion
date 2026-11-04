"use client";

import React, { useState, useEffect } from "react";
import { User, Sparkles, Clock, Moon, Sun, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useProfile } from "@/context/ProfileContext";
import { useToast } from "@/context/ToastContext";

export function ProfileSettingsSection() {
  const { profile, updateProfile, loading } = useProfile();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [companionName, setCompanionName] = useState("");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");
  const [commitments, setCommitments] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setCompanionName(profile.companionName ?? "Nikki");
      setWakeTime(profile.dailyRhythm?.wakeTime ?? "07:00");
      setSleepTime(profile.dailyRhythm?.sleepTime ?? "23:00");
      setCommitments(profile.dailyRhythm?.commitments ?? "");
    }
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        companionName: companionName.trim() || "Nikki",
        dailyRhythm: {
          wakeTime,
          sleepTime,
          commitments: commitments.trim() || null,
        },
      });
      setIsSaved(true);
      showToast("Profile settings saved!", "success");
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      showToast("Could not save profile settings.", "danger");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card id="profile" className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-primary flex items-center gap-2">
            <User className="h-5 w-5 text-cyan-400" />
            Profile &amp; Companion
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Personalize how Nikki addresses you and tailor your daily schedule boundaries.
          </p>
        </div>
        {isSaved && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <CheckCircle className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Your Name or Nickname"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What should Nikki call you?"
            disabled={loading || isSaving}
          />
          <Input
            label="Companion Name"
            value={companionName}
            onChange={(e) => setCompanionName(e.target.value)}
            placeholder="Nikki"
            disabled={loading || isSaving}
            helperText="Nikki's name across all conversations and notifications."
          />
        </div>

        <div className="border-t border-white/5 pt-4">
          <h3 className="text-sm font-semibold text-ink-primary mb-1 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-purple-400" />
            Daily Rhythm &amp; Boundaries
          </h3>
          <p className="text-xs text-ink-muted mb-4">
            Nikki uses these to adapt timetable plans and avoid disturbing your rest.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink-secondary mb-1 flex items-center gap-1">
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                Usual Wake-up Time
              </label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                disabled={loading || isSaving}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent-secondary/50 focus:border-accent-secondary/50"
              />
            </div>

            <div>
              <label className="text-xs text-ink-secondary mb-1 flex items-center gap-1">
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                Target Bedtime
              </label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                disabled={loading || isSaving}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent-secondary/50 focus:border-accent-secondary/50"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-ink-secondary mb-1 block">
              Fixed Commitments &amp; Routines
            </label>
            <input
              type="text"
              value={commitments}
              onChange={(e) => setCommitments(e.target.value)}
              placeholder="e.g. College classes Mon-Fri 9am-2pm, Gym at 6pm"
              disabled={loading || isSaving}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent-secondary/50 focus:border-accent-secondary/50"
            />
            <p className="text-[11px] text-ink-muted mt-1">
              Nikki automatically preserves these hours when generating your schedule.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" isLoading={isSaving} disabled={loading} size="sm">
            Save Profile Settings
          </Button>
        </div>
      </form>
    </Card>
  );
}

