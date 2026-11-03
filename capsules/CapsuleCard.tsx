"use client";

import { Card } from "@/components/ui/Card";
import { formatCapsuleUnlockLabel, formatWrittenLabel } from "@/lib/capsules/format";
import type { CapsuleSummary } from "@/types/capsule";

interface CapsuleCardProps {
  capsule: CapsuleSummary;
  onOpen: (capsule: CapsuleSummary) => void;
}

/** One capsule as a sealed/private-feeling card — never a table row. */
export function CapsuleCard({ capsule, onOpen }: CapsuleCardProps) {
  const canOpen = capsule.status === "UNLOCKED";

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-display text-base font-medium text-ink-primary">
          {capsule.title ?? formatCapsuleUnlockLabel(capsule)}
        </p>
        {capsule.title && <p className="mt-0.5 text-sm text-ink-secondary">{formatCapsuleUnlockLabel(capsule)}</p>}
        <p className="mt-1 text-xs text-ink-muted">{formatWrittenLabel(capsule.createdAt)}</p>
      </div>
      <span aria-hidden="true" className="text-xl">
        {capsule.status === "SEALED" ? "🔒" : capsule.status === "UNLOCKED" ? "✨" : "💌"}
      </span>
    </div>
  );

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpen(capsule)}
        className="w-full text-left"
        aria-label={`Open capsule${capsule.title ? `: ${capsule.title}` : ""}`}
      >
        <Card hoverable className="border border-accent-secondary/30 shadow-glow">
          {content}
        </Card>
      </button>
    );
  }

  return <Card className={capsule.status === "SEALED" ? "opacity-80" : ""}>{content}</Card>;
}