"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import clsx from "clsx";
import { slideUp } from "@/lib/motion";

interface StorySectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

/** Scroll-reveals once, then stays — used by every narrative beat on the landing page. */
export function StorySection({ children, className, id }: StorySectionProps) {
  return (
    <motion.section
      id={id}
      variants={slideUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      className={clsx("mx-auto w-full max-w-2xl px-6 py-16 md:py-24", className)}
    >
      {children}
    </motion.section>
  );
}