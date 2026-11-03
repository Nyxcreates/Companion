/**
 * The deletable groups of a user's Companion data. Shared by the
 * client (Settings → Data & Privacy) and the server (DELETE /api/data)
 * so the two can never disagree about what a scope covers.
 */
export const DATA_SCOPES = [
  "conversations",
  "memories",
  "capsules",
  "journal",
  "goals",
  "tasks",
  "schedule",
  "focus",
] as const;

export type DataScope = (typeof DATA_SCOPES)[number];
export type DeleteScope = DataScope | "all";

export interface DataScopeInfo {
  label: string;
  /** Plain-language "what this removes" line used in the confirmation dialog. */
  removes: string;
  /** What is deliberately kept / adjusted, so the dialog never surprises the user. */
  sideEffect?: string;
}

export const DATA_SCOPE_INFO: Record<DataScope, DataScopeInfo> = {
  conversations: {
    label: "Conversations",
    removes: "Every chat with your companion, all of its messages, and the mood notes saved from them.",
    sideEffect: "Things your companion remembered stay, but no longer point back to a conversation.",
  },
  memories: {
    label: "What your companion remembers",
    removes: "Everything your companion has remembered about you.",
  },
  capsules: {
    label: "Memory capsules & Memory Garden",
    removes: "Every memory capsule — sealed or opened. Your Memory Garden is grown from them, so it empties too.",
  },
  journal: {
    label: "Journal entries",
    removes: "Every journal entry.",
  },
  goals: {
    label: "Goals",
    removes: "Every goal, including completed ones.",
    sideEffect: "Your tasks are kept; they simply stop belonging to a goal.",
  },
  tasks: {
    label: "Tasks",
    removes: "Every task.",
    sideEffect:
      "Past focus sessions are kept (they'll show as “Untitled task”), a running session is ended, and timetable entries lose their task link.",
  },
  schedule: {
    label: "Timetables",
    removes: "Every saved daily timetable.",
  },
  focus: {
    label: "Focus history",
    removes: "Every focus session you've recorded.",
    sideEffect: "Your tasks are kept.",
  },
};

export const CONFIRM_ALL_PHRASE = "DELETE";

export function isDataScope(value: unknown): value is DataScope {
  return typeof value === "string" && (DATA_SCOPES as readonly string[]).includes(value);
}

export function isDeleteScope(value: unknown): value is DeleteScope {
  return value === "all" || isDataScope(value);
}

export type DataCounts = Record<DataScope, number>;
export type DeleteResult = Partial<Record<DataScope, number>> & { usedTransaction: boolean };