/**
 * Structured agent contract. Nikki never returns a bare string — the
 * model is instructed to always return this shape, which is then
 * validated before anything downstream trusts it. See agent.ts.
 */

import type { AgentEmotion } from "./emotion";
import type { GoalSummary } from "@/types/goal";
import type { TaskSummary } from "@/types/task";
import type { MemoryType } from "@/lib/memory/types";
import type { CurrentTimeInfo } from "@/lib/time/currentTime";

export type AgentIntent =
  | "conversation"
  | "planning"
  | "timetable_request"
  | "timetable_save"
  | "task_request"
  | "mood_checkin"
  | "goal_discussion"
  | "reschedule_request"
  | "timetable_delete"
  | "memory_request"
  | "farewell"
  | "welcome_back";

export const AGENT_INTENTS: AgentIntent[] = [
  "conversation",
  "planning",
  "timetable_request",
  "timetable_save",
  "task_request",
  "mood_checkin",
  "goal_discussion",
  "reschedule_request",
  "timetable_delete",
  "memory_request",
  "farewell",
  "welcome_back",
];

export interface AgentAction {
  type: string;
  payload: Record<string, unknown>;
}

export interface MemoryCandidate {
  type: MemoryType;
  content: string;
  confidence: number;
  reason: string;
  /** If set and refers to a real, owned, active memory, that memory is updated in place instead of creating a duplicate/contradictory row. */
  supersedesId?: string;
}

/** A memory as injected into context — deliberately minimal; Nikki should just know it, not reason about her own confidence in it. */
export interface AgentMemoryItem {
  id: string;
  type: MemoryType;
  content: string;
}

export interface AgentResponse {
  message: string;
  intent: AgentIntent;
  actions: AgentAction[];
  needsClarification: boolean;
  emotion: AgentEmotion;
  memoryCandidates: MemoryCandidate[];
}

export interface ChatTurn {
  role: "user" | "nikki";
  text: string;
}

/** What the agent currently knows about the user — only real, existing data. */
export interface AgentContext {
  displayName: string | null;
  companionName: string | null;
  goals: string[];
  customGoal: string | null;
  dailyRhythm: {
    wakeTime: string | null;
    sleepTime: string | null;
    focusPeriods: string[];
    commitments: string | null;
  };
  helpPreferences: string[];
  activeGoals: GoalSummary[];
  /** Pending + in-progress tasks. */
  activeTasks: TaskSummary[];
  /** A bounded, relevance-ish window of active long-term memories. */
  relevantMemories: AgentMemoryItem[];
  /** Authoritative runtime clock and timezone. */
  currentTimeInfo: CurrentTimeInfo;
  /** Active living world environment theme if selected. */
  livingEnvironment?: string | null;
}
