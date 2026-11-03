"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useProfile } from "@/context/ProfileContext";

export function OpeningStorySection() {
  const router = useRouter();
  const { profile } = useProfile();

  const handleReplay = () => {
    router.push("/?replay=true");
  };

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-primary">
            Opening Story Experience
          </h2>
          <p className="text-sm text-ink-secondary">
            Replay the cinematic prologue introducing Companion, Nikki, and your personal universe.
          </p>
        </div>
        <div className="mt-2 sm:mt-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-xs font-medium text-cyan-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            {profile?.introCompleted ? "Completed" : "Available"}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-slate-900/40 p-4 text-xs text-ink-muted">
        <p>
          ✦ Replaying the cinematic introduction is completely safe — it does not reset, modify, or erase your goals, tasks, memories, timetable, or chat history.
        </p>
      </div>

      <div className="flex items-center justify-start pt-2">
        <Button
          variant="secondary"
          onClick={handleReplay}
          className="inline-flex items-center gap-2"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-cyan-400" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
          <span>Replay Opening Story</span>
        </Button>
      </div>
    </Card>
  );
}
