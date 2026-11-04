export const NOTIFICATION_CATEGORIES = [
  "task_reminder",
  "goal_deadline",
  "timetable_reminder",
  "focus_reminder",
  "break_reminder",
  "wellbeing_water_food",
  "mood_checkin",
  "sleep_reminder",
  "commitment_reminder",
  "nikki_supportive",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

