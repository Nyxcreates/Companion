"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";

export interface SectionTab {
  id: string;
  label: string;
}

/** Reads/writes the active tab from the `?tab=` query param so tabs are linkable and survive refresh. Pages using it must sit inside <Suspense>. */
export function useTabParam(tabs: SectionTab[], defaultId: string): [string, (id: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const active = tabs.some((t) => t.id === raw) ? (raw as string) : defaultId;

  const setTab = useCallback(
    (id: string) => router.replace(`${pathname}?tab=${id}`, { scroll: false }),
    [router, pathname]
  );
  return [active, setTab];
}

interface SectionTabsProps {
  tabs: SectionTab[];
  activeId: string;
  onChange: (id: string) => void;
  label: string;
  /** Used to link each tab to its panel (aria-controls / aria-labelledby). */
  idPrefix: string;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/** Accessible tab strip: arrow keys / Home / End move between tabs. */
export function SectionTabs({ tabs, activeId, onChange, label, idPrefix }: SectionTabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === activeId);
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === -1) return;
    e.preventDefault();
    const target = tabs[next].id;
    onChange(target);
    refs.current[target]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            role="tab"
            type="button"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={clsx(
              "flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/60",
              selected ? "bg-white/10 text-ink-primary" : "text-ink-muted hover:bg-white/5 hover:text-ink-primary"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}