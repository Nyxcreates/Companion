"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CompanionCharacter } from "@/components/character/CompanionCharacter";
import { SpeechBubble } from "@/components/character/SpeechBubble";
import { Button } from "@/components/ui/Button";
import { authFetch, AuthFetchError } from "@/lib/api/authFetch";
import { parseApiResponse } from "@/lib/api/parseApiResponse";
import { useToast } from "@/context/ToastContext";
import { fadeIn, scaleIn } from "@/lib/motion";
import type { CapsuleDetail, CapsuleSummary } from "@/types/capsule";

interface OpenCapsuleRevealProps {
  capsule: CapsuleSummary;
  onClose: () => void;
  onOpened: (capsule: CapsuleDetail) => void;
}

type Stage = "invite" | "revealed";

export function OpenCapsuleReveal({ capsule, onClose, onOpened }: OpenCapsuleRevealProps) {
  const { showToast } = useToast();
  const [stage, setStage] = useState<Stage>("invite");
  const [detail, setDetail] = useState<CapsuleDetail | null>(null);
  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    setOpening(true);
    try {
      const res = await authFetch(`/api/capsules/${capsule.id}/open`, { method: "POST" });
      const { data, error } = await parseApiResponse<CapsuleDetail>(res);
      if (error || !data) {
        showToast(error?.message ?? "Couldn't open that just now.", "danger");
        return;
      }
      setDetail(data);
      setStage("revealed");
      onOpened(data);
    } catch (err) {
      showToast(err instanceof AuthFetchError ? err.message : "Couldn't open that just now.", "danger");
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Opening a memory capsule"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-surface-primary/90 p-6 text-center backdrop-blur-md"
    >
      <div className="h-28 w-28">
        <CompanionCharacter pose={stage === "revealed" ? "celebrate" : "think"} className="h-full w-full" />
      </div>

      <AnimatePresence mode="wait">
        {stage === "invite" ? (
          <motion.div key="invite" variants={scaleIn} initial="hidden" animate="visible" exit="exit">
            <SpeechBubble>I think it&apos;s time to open something you left for yourself.</SpeechBubble>
          </motion.div>
        ) : (
          <motion.div
            key="revealed"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="glass-card max-w-md p-6"
          >
            {detail?.title && <p className="mb-2 font-display text-lg text-ink-primary">{detail.title}</p>}
            <p className="whitespace-pre-wrap text-ink-secondary">{detail?.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3">
        {stage === "invite" ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={opening}>
              Not yet
            </Button>
            <Button variant="primary" onClick={handleOpen} isLoading={opening}>
              Open it
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </motion.div>
  );
}