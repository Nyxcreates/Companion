import type { JournalEntry } from "@/types/journal";

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * "September 29" / "September 29, 2025" — always computed from the
 * browser's local time zone (JS Date's local getters), never from the
 * raw UTC ISO string directly, so an entry never appears to land on
 * the wrong day for the user reading it (spec section 12).
 */
function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    undefined,
    sameYear ? { month: "long", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" }
  );
}

export function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export interface JournalDayGroup {
  label: string;
  entries: JournalEntry[];
}

/** Groups entries (already sorted newest-first by the API) into date-labeled sections by the day they were created in the viewer's own local time zone — the client-side display concern journalService.ts's listJournalEntries doc comment defers to this function. */
export function groupEntriesByDay(entries: JournalEntry[]): JournalDayGroup[] {
  const groups: JournalDayGroup[] = [];
  let currentDayKey: number | null = null;

  for (const entry of entries) {
    const created = new Date(entry.createdAt);
    const dayKey = startOfLocalDay(created);

    if (dayKey !== currentDayKey) {
      groups.push({ label: formatDayLabel(entry.createdAt), entries: [entry] });
      currentDayKey = dayKey;
    } else {
      groups[groups.length - 1].entries.push(entry);
    }
  }

  return groups;
}