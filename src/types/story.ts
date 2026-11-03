/**
 * Cinematic Opening Story Types.
 * Defines the 8-scene sequential opening introduction for Companion.
 */

export type CinematicSceneId =
  | "the-beginning"
  | "reality-of-life"
  | "arrival-of-companion"
  | "life-understood"
  | "dreams-become-steps"
  | "space-to-begin-again"
  | "your-world-your-way"
  | "enter-companion";

export interface NarrativeBlock {
  id: string;
  lines: string[];
  visualCue?: string;
  pauseAfterMs?: number;
}

export interface CinematicSceneDefinition {
  id: CinematicSceneId;
  index: number; // 0 to 7
  title: string;
  badge: string;
  blocks: NarrativeBlock[];
  featureHighlight?: {
    tag: string;
    description: string;
  };
  hasCharacterStageSlot?: boolean;
}

/** Legacy type aliases to maintain compatibility with existing imports */
export type EnvironmentId = "space" | "garden" | "ocean" | "room" | "focus";

export type CompanionPose = "idle" | "walk" | "turn" | "wave" | "lookAhead" | "sit" | "think" | "celebrate";

export type StoryEventId =
  | "OPEN_ONBOARDING"
  | "OPEN_GOALS"
  | "OPEN_PLANNER"
  | "OPEN_MOOD"
  | "OPEN_FOCUS"
  | "OPEN_MEMORY"
  | "OPEN_CAPSULES"
  | "OPEN_REWARDS"
  | "ENTER_APP";

export interface DialogueLine {
  id: string;
  speaker: "companion";
  text: string;
}

export interface StoryScene {
  id: string;
  title: string;
  environment: EnvironmentId;
  companionPose?: CompanionPose;
  dialogue: DialogueLine[];
  event?: StoryEventId;
  brighten?: boolean;
}
