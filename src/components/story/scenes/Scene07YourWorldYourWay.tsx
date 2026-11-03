"use client";

import { motion } from "framer-motion";
import { CharacterStageSlot } from "@/components/story/CharacterStageSlot";

interface Scene07Props {
  currentBlockIndex: number;
}

export function Scene07YourWorldYourWay({ currentBlockIndex }: Scene07Props) {
  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Modular Character Stage Slot */}
      <div className="relative mb-6 flex w-full max-w-sm items-center justify-center">
        <CharacterStageSlot
          className="scale-90 sm:scale-100"
          glowColor="rgba(192, 132, 252, 0.4)"
        />

        {/* Floating personal dimension tags */}
        <motion.div
          className="absolute -left-4 top-8 hidden sm:flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-slate-900/80 px-2.5 py-1 text-xs text-purple-200 backdrop-blur-md"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <span>✦ Custom Expression</span>
        </motion.div>

        <motion.div
          className="absolute -right-4 top-14 hidden sm:flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-slate-900/80 px-2.5 py-1 text-xs text-cyan-200 backdrop-blur-md"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <span>✦ Adaptive Tone</span>
        </motion.div>

        <motion.div
          className="absolute -left-2 bottom-6 hidden sm:flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-slate-900/80 px-2.5 py-1 text-xs text-amber-200 backdrop-blur-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <span>✦ Your Rhythm</span>
        </motion.div>
      </div>

      {/* Narrative Text */}
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.p
          className="font-display text-2xl font-light tracking-wide text-ink-primary sm:text-3xl md:text-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.2 }}
        >
          &ldquo;Your companion. Your pace. Your space.&rdquo;
        </motion.p>

        <motion.p
          className="max-w-xl text-base text-ink-secondary sm:text-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
        >
          A presence designed to grow alongside you. Customizable, personal, and always in tune with the way you think and live.
        </motion.p>

        {currentBlockIndex >= 1 && (
          <motion.div
            className="mt-2 flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <p className="max-w-md text-sm text-ink-muted">
              Choose how Nikki speaks, what she focuses on, and make this corner of the digital universe entirely your own.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
