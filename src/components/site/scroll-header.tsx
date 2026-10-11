"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Sticky header that gains a shadow and tighter background once the page scrolls. */
export function ScrollHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,box-shadow,border-color] duration-300",
        scrolled
          ? "border-line bg-surface/90 shadow-[0_8px_24px_-12px_rgb(16_32_48/0.18)] backdrop-blur-md"
          : "border-transparent bg-surface/70 backdrop-blur",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-accent-500),transparent)] transition-opacity duration-500",
          scrolled ? "opacity-60" : "opacity-0",
        )}
      />
    </header>
  );
}
