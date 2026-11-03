"use client";

import { motion } from "framer-motion";
import { CharacterEntrance } from "@/components/character/CharacterEntrance";
import { ease } from "@/lib/motion";

export function OpeningScene() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-companion-gradient" />
      <CharacterEntrance />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.5, ease: ease.standard }}
        className="mt-10 max-w-lg"
      >
        <h1 className="font-display text-3xl font-semibold text-ink-primary sm:text-4xl">Companion</h1>
        <p className="mt-3 text-ink-secondary sm:text-lg">A small presence for your everyday life.</p>
      </motion.div>
    </section>
  );
}