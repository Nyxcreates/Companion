"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { NavItem } from "./Sidebar";

interface MobileNavProps {
  items: NavItem[];
}

/** Bottom tab bar for small screens — mirrors Sidebar's nav items exactly, hidden on desktop (md:hidden) where Sidebar takes over. */
export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-950/80 px-2 py-2 backdrop-blur-lg md:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex-1 rounded-xl py-1.5 text-center text-xs font-medium transition-colors duration-200",
              active
                ? "bg-slate-200/80 dark:bg-white/10 text-ink-primary font-semibold"
                : "text-ink-muted hover:text-ink-primary"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
