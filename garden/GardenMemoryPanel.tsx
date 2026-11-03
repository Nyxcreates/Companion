"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PlantGlyph } from "./GardenPlant";
import { deriveStage, deriveTone } from "@/lib/garden/derive";
import { formatCapsuleUnlockLabel, formatWrittenLabel } from "@/lib/capsules/format";
import type { CapsuleStatus, CapsuleSummary } from "@/types/capsule";

interface GardenMemoryPanelProps {
  capsule: CapsuleSummary | null;
  isOpen: boolean;
  onClose: () => void;
  /** Hands an UNLOCKED capsule to the existing open-capsule reveal. */
  onOpenCapsule: (capsule: CapsuleSummary) => void;
  /** Sends a SEALED / OPENED capsule to the existing Capsules page. */
  onGoToCapsules: () => void;
}

const STATUS_LINES: Record<CapsuleStatus, string> = {
  SEALED: "Still growing. It will open when it's time.",
  UNLOCKED: "It's ready whenever you are.",
  OPENED: "You've already opened this one.",
};

/**
 * Lightweight detail for one garden memory: what it is, when, and how
 * it's doing — never the capsule's message, and never a second copy of
 * the capsule UI. The action always leads back into the existing
 * Capsule experience, where opening and deleting already live.
 */
export function GardenMemoryPanel({ capsule, isOpen, onClose, onOpenCapsule, onGoToCapsules }: GardenMemoryPanelProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={capsule?.title ?? "A memory capsule"}>
      {capsule && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="h-20 w-16 flex-shrink-0">
              <PlantGlyph stage={deriveStage(capsule)} tone={deriveTone(capsule.id)} className="h-full w-full" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Memory Capsule</p>
              <p className="mt-1 text-sm text-ink-secondary">{formatCapsuleUnlockLabel(capsule)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{formatWrittenLabel(capsule.createdAt)}</p>
            </div>
          </div>

          <p className="text-sm text-ink-secondary">{STATUS_LINES[capsule.status]}</p>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {capsule.status === "UNLOCKED" ? (
              <Button variant="primary" onClick={() => onOpenCapsule(capsule)}>
                Open it
              </Button>
            ) : (
              <Button variant="secondary" onClick={onGoToCapsules}>
                Open in Capsules
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}