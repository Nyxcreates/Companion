"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CharacterPlaceholder } from "@/components/character/CharacterPlaceholder";

export interface NavItem {
  href: string;
  label: string;
}

interface SidebarProps {
  items: NavItem[];
}

export function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:gap-8 md:border-r md:border-slate-200/80 dark:md:border-white/10 md:bg-white/40 dark:md:bg-slate-950/40 md:p-6 md:backdrop-blur-md">
      <div className="flex items-center gap-3">
        <CharacterPlaceholder size={40} />
        <span className="font-display font-semibold text-ink-primary">Companion</span>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200",
                active
                  ? "bg-slate-200/90 dark:bg-white/10 text-ink-primary shadow-xs"
                  : "text-ink-muted hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-ink-primary"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
