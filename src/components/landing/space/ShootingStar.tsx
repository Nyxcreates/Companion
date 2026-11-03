"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { seededRandom } from "@/lib/pseudoRandom";

interface Comet {
  id: number;
  startX: number;
  startY: number;
  rotate: number;
  travelX: number;
  travelY: number;
}

/**
 * A rare comet crossing the scene, then a long, randomized wait (25–50s)
 * before the next one — long enough that spotting one should feel like
 * a small, quiet moment rather than a scheduled effect. Disabled under
 * reduced motion.
 */
export function ShootingStar() {
  const prefersReducedMotion = useReducedMotion();
  const [comet, setComet] = useState<Comet | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const loop = () => {
      const seed = Date.now() + counter.current * 97;
      const delay = 25000 + seededRandom(seed) * 25000;

      timeoutId = setTimeout(() => {
        if (cancelled) return;
        counter.current += 1;
        setComet({
          id: seed,
          startX: 8 + seededRandom(seed + 1) * 28,
          startY: 8 + seededRandom(seed + 2) * 22,
          rotate: 22 + seededRandom(seed + 3) * 14,
          travelX: 220 + seededRandom(seed + 4) * 90,
          travelY: 110 + seededRandom(seed + 5) * 70,
        });

        setTimeout(() => {
          if (!cancelled) setComet(null);
        }, 1300);

        loop();
      }, delay);
    };

    loop();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {comet && (
          <motion.span
            key={comet.id}
            className="absolute h-px w-24 rounded-full bg-gradient-to-r from-transparent via-white to-transparent"
            style={{ left: `${comet.startX}%`, top: `${comet.startY}%`, rotate: comet.rotate }}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x: comet.travelX, y: comet.travelY }}
            transition={{ duration: 1.1, ease: "easeIn" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}