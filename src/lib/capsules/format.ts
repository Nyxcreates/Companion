import type { CapsuleStatus } from "@/types/capsule";

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    undefined,
    sameYear ? { month: "long", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" }
  );
}

/** The primary line shown on a capsule card — matches the product spec's example copy ("Open on December 22", "Something is waiting for you.", "Opened on June 14"). */
export function formatCapsuleUnlockLabel(capsule: {
  status: CapsuleStatus;
  unlockAt: string;
  openedAt: string | null;
}): string {
  if (capsule.status === "OPENED" && capsule.openedAt) {
    return `Opened on ${formatDateLabel(capsule.openedAt)}`;
  }
  if (capsule.status === "UNLOCKED") {
    return "Something is waiting for you.";
  }
  return `Open on ${formatDateLabel(capsule.unlockAt)}`;
}

/** The secondary line — "Written today" / "Written September 22". */
export function formatWrittenLabel(createdAt: string): string {
  const created = startOfDay(new Date(createdAt));
  const today = startOfDay(new Date());
  if (created === today) return "Written today";
  return `Written ${formatDateLabel(createdAt)}`;
}