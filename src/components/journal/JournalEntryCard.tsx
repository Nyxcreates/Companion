"use client";

import { Card } from "@/components/ui/Card";
import { formatEntryTime } from "@/lib/journal/format";
import type { JournalEntry } from "@/types/journal";

const MOOD_LABELS: Record<string, string> = {
  happy: "Happy",
  calm: "Calm",
  neutral: "Neutral",
  tired: "Tired",
  stressed: "Stressed",
  sad: "Sad",
  anxious: "Anxious",
  frustrated: "Frustrated",
  excited: "Excited",
  overwhelmed: "Overwhelmed",
};

/** First line (or ~140 chars) of an entry's content, for a quiet preview — never a full re-render of the entry on its own card, since this is a personal space, not a feed. */
function previewText(content: string): string {
  const firstLine = content.split("\n").find((line) => line.trim().length > 0) ?? "";
  return firstLine.length > 140 ? `${firstLine.slice(0, 140).trimEnd()}…` : firstLine;
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onOpen: (entry: JournalEntry) => void;
}

export function JournalEntryCard({ entry, onOpen }: JournalEntryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="w-full text-left"
      aria-label={`Open entry${entry.title ? `: ${entry.title}` : ""}`}
    >
      <Card hoverable>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-medium text-ink-primary">
              {entry.title ?? previewText(entry.content) ?? "Untitled entry"}
            </p>
            {entry.title && <p className="mt-0.5 truncate text-sm text-ink-secondary">{previewText(entry.content)}</p>}
            <p className="mt-1 text-xs text-ink-muted">{formatEntryTime(entry.createdAt)}</p>
          </div>
          {entry.mood && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-ink-secondary">
              {MOOD_LABELS[entry.mood] ?? entry.mood}
            </span>
          )}
        </div>
      </Card>
    </button>
  );
}