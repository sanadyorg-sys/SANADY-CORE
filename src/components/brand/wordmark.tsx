import { cn } from "@/lib/cn";

/**
 * ⚠ PLACEHOLDER BRAND MARK
 * The official SANADY logo has not been supplied. This typographic wordmark
 * stands in until the original asset is delivered. To integrate the real
 * logo: add it as /public/brand/sanady-logo.svg (and a light variant for
 * dark backgrounds), then render it here with next/image, respecting its
 * proportions and clear-space. Do not recolor or redraw the original.
 */
export function Wordmark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center gap-2 font-semibold tracking-[0.14em]",
        tone === "dark" ? "text-navy-700" : "text-white",
        className,
      )}
      aria-label="SANADY"
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-[1.1em] w-[0.28em] rounded-[2px]",
          tone === "dark" ? "bg-teal-600" : "bg-teal-300",
        )}
      />
      <span aria-hidden>SANADY</span>
    </span>
  );
}
