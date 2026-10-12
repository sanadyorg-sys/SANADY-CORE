import Image from "next/image";
import lettersDark from "../../../public/brand/sanady-logo-letters.png";
import lettersLight from "../../../public/brand/sanady-logo-light-letters.png";
import eyes from "../../../public/brand/sanady-logo-eyes.png";
import smile from "../../../public/brand/sanady-logo-smile.png";
import tagline from "../../../public/brand/sanady-tagline.png";
import smileHd from "../../../public/brand/sanady-smile.png";
import { cn } from "@/lib/cn";

/**
 * Official Fondation Sanady logo.
 * Supports:
 * - `variant="default"` : Official dual-tone logo.
 * - `variant="orange"`  : Same as default (kept for existing call sites).
 * - `variant="light"`   : Approved adaptation for dark backgrounds.
 */
export function BrandLogo({
  variant = "default",
  className,
  priority = false,
}: {
  variant?: "default" | "light" | "orange";
  /** Set the height (e.g. "h-9"); width follows the logo's proportions. */
  className?: string;
  priority?: boolean;
}) {
  // The logo is drawn from three stacked layers (scripts/brand/split-logo.mjs)
  // so the smile and the eyes can move: see `.brand-logo` in globals.css.
  const letters = variant === "light" ? lettersLight : lettersDark;
  return (
    <span className={cn("brand-logo relative inline-block aspect-[694/316] h-9 select-none", className)}>
      <Image src={letters} alt="Fondation Sanady" priority={priority} fill sizes="(min-width: 1024px) 220px, 160px" />
      <Image src={eyes} alt="" aria-hidden priority={priority} fill sizes="(min-width: 1024px) 220px, 160px" className="brand-logo-eyes" />
      <Image src={smile} alt="" aria-hidden priority={priority} fill sizes="(min-width: 1024px) 220px, 160px" className="brand-logo-smile" />
    </span>
  );
}

/** « Préparons les adultes du Maroc de demain » — the foundation's signature. */
export function BrandTagline({ className }: { className?: string }) {
  return (
    <Image
      src={tagline}
      alt="Préparons les adultes du Maroc de demain"
      className={cn("h-10 w-auto select-none", className)}
      sizes="280px"
    />
  );
}

/** Official Fondation Sanady minimalist orange smile glyph. */
export function BrandSmile({ className }: { className?: string }) {
  return (
    <Image
      src={smileHd}
      alt="Fondation Sanady — Symbole"
      className={cn("h-8 w-auto select-none", className)}
      sizes="64px"
    />
  );
}

