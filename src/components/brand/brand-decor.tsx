import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Underlines a word with the orange Sanady smile, drawn in on page load.
 * Purely decorative: the SVG is hidden from assistive technology.
 */
export function SmileUnderline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("smile-underline", className)}>
      {children}
      <svg viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden focusable="false">
        <path
          d="M4 6 C 50 24, 150 24, 196 6"
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          className="animate-smile [animation-delay:400ms]"
        />
      </svg>
    </span>
  );
}

/** Three orange dots, as on the Fondation Sanady logo. */
export function BrandDots({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-1", className)}>
      <span className="size-1.5 rounded-full bg-accent-500" />
      <span className="size-1.5 rounded-full bg-accent-400" />
      <span className="size-1.5 rounded-full bg-accent-300" />
    </span>
  );
}
