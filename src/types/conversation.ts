import type { ScheduleSummary } from "@/types/schedule";

/** Client-facing shapes for the conversation history feature — mirrors src/types/profile.ts's pattern (plain, JSON-safe, no Mongo internals). */

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  /** First ~120 chars of the most recent message, or null for a conversation with no messages yet. */
  preview: string | null;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "nikki";
  text: string;
  createdAt: string;
  schedule?: ScheduleSummary | null;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  messages: ConversationMessage[];
}