"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs as RadixTabs } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tabClass = (active: boolean) =>
  cn(
    "relative -mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-1 text-body font-medium transition-colors",
    active ? "border-teal-600 text-ink-900" : "border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800",
  );

/** Route-based tabs (each tab is a URL). */
export function LinkTabs({
  items,
  exact = false,
  activeHref,
  className,
}: {
  items: Array<{ href: string; label: ReactNode; count?: number }>;
  exact?: boolean;
  /** Explicit active item (for tabs that differ only by query string). */
  activeHref?: string;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className={cn("border-b border-line", className)}>
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {items.map((item) => {
          const active = activeHref !== undefined ? item.href === activeHref : exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {item.label}
                {item.count !== undefined ? (
                  <span className="tabular rounded-sm bg-ink-100 px-1.5 text-caption text-ink-600">{item.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** In-page tabs (Radix: arrow-key navigation, ARIA roles). */
export function Tabs({
  defaultValue,
  items,
  className,
}: {
  defaultValue: string;
  items: Array<{ value: string; label: ReactNode; content: ReactNode }>;
  className?: string;
}) {
  return (
    <RadixTabs.Root defaultValue={defaultValue} className={className}>
      <RadixTabs.List className="flex gap-6 overflow-x-auto border-b border-line" aria-label="Sections">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              tabClass(false),
              "data-[state=active]:border-teal-600 data-[state=active]:text-ink-900",
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className="pt-5 focus-visible:outline-none">
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
