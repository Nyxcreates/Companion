"use client";

import { motion } from "framer-motion";
import { Sidebar, type NavItem } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { LivingWorldBackdrop } from "@/components/world/LivingWorldBackdrop";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { NikkiProactivePresence } from "@/components/character/NikkiProactivePresence";
import { slideUp } from "@/lib/motion";

/**
 * Each destination is one mental model:
 *  Home     — Nikki and your day
 *  Plan     — Goals → Tasks → Schedule (what, how, when)
 *  Focus    — doing the work
 *  Journal  — reflecting
 *  Memories — Garden, Capsules and what Nikki remembers
 *  Settings — Appearance, Living Environment & Privacy
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/plan", label: "Plan" },
  { href: "/focus", label: "Focus" },
  { href: "/journal", label: "Journal" },
  { href: "/memories", label: "Memories" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col md:flex-row">
      {/* Persistent living environment backdrop (Space, Garden, or Ocean) */}
      <LivingWorldBackdrop calm={true} />

      <Sidebar items={NAV_ITEMS} />
      <motion.main
        variants={slideUp}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex-1 px-4 py-6 pb-24 md:px-10 md:py-8 md:pb-10"
      >
        <AppTopBar />
        {children}
      </motion.main>
      <NikkiProactivePresence />
      <MobileNav items={NAV_ITEMS} />
    </div>
  );
}
