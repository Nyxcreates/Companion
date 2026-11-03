import type { StoryEventId } from "@/types/story";

/**
 * Human-readable labels for each placeholder feature event, used only
 * to tell the visitor honestly that the feature isn't built yet. No
 * handler in this file pretends the feature works.
 */
export const STORY_EVENT_LABELS: Record<StoryEventId, string> = {
  OPEN_ONBOARDING: "Onboarding",
  OPEN_GOALS: "Goals",
  OPEN_PLANNER: "The planner",
  OPEN_MOOD: "Mood check-in",
  OPEN_FOCUS: "Focus Mode",
  OPEN_MEMORY: "Memory Garden",
  OPEN_CAPSULES: "Memory Capsules",
  OPEN_REWARDS: "Growth & rewards",
  ENTER_APP: "Companion",
};