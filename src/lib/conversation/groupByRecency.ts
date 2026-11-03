import type { ConversationSummary } from "@/types/conversation";

export interface ConversationGroup {
  label: "Today" | "Yesterday" | "Earlier";
  items: ConversationSummary[];
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Groups an already-sorted (most-recent-first) conversation list into Today / Yesterday / Earlier buckets, dropping any bucket that's empty. */
export function groupConversationsByRecency(conversations: ConversationSummary[]): ConversationGroup[] {
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;

  const buckets: Record<ConversationGroup["label"], ConversationSummary[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  for (const convo of conversations) {
    const day = startOfDay(new Date(convo.updatedAt));
    if (day === today) buckets.Today.push(convo);
    else if (day === yesterday) buckets.Yesterday.push(convo);
    else buckets.Earlier.push(convo);
  }

  return (["Today", "Yesterday", "Earlier"] as const)
    .filter((label) => buckets[label].length > 0)
    .map((label) => ({ label, items: buckets[label] }));
}

/** "3:10 PM" for today, "Sep 18" for anything older. */
export function formatConversationTimestamp(iso: string): string {
  const date = new Date(iso);
  const today = startOfDay(new Date());
  const day = startOfDay(date);

  if (day === today) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}