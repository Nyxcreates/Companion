import type { NotificationCategory } from "@/lib/notifications/categories";
import type { CheckInFrequency, FloatingPresenceMode, LearnedInterventionWeights } from "@/models/NotificationPreference";

export type { NotificationCategory, CheckInFrequency, FloatingPresenceMode, LearnedInterventionWeights };

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  read: boolean;
  dismissed: boolean;
  snoozedUntil?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  proactiveEnabled: boolean;
  categoriesEnabled: Record<NotificationCategory, boolean>;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  checkInFrequency: CheckInFrequency;
  floatingPresence: FloatingPresenceMode;
  breakIntervalMinutes: number;
  waterIntervalMinutes: number;
  dailyPhoneGoalMinutes: number;
  pausedUntil: string | null;
  learnedWeights: LearnedInterventionWeights;
}

export interface CheckInTrigger {
  id: string;
  triggerType:
    | "working_too_long"
    | "stressed_mood"
    | "excited_mood"
    | "late_night"
    | "inactive_return"
    | "task_waiting"
    | "wellbeing_water"
    | "completed_something";
  message: string;
  subText?: string;
  characterPose: "greet" | "idle" | "point" | "ponder" | "celebrate";
  characterGaze: "center" | "left" | "right" | "up";
  actions: {
    label: string;
    action: "accept" | "dismiss" | "snooze" | "talk";
    payload?: string;
    variant?: "primary" | "secondary" | "ghost";
  }[];
  interventionType?: "break" | "water" | "stretch" | "music" | "chat" | "sleep";
}
