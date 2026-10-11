import Image from "next/image";
import logo from "../../../public/brand/sanady-logo.png";
// Same official logo, processed to the exact brand orange #F95A05 (scripts/brand/build-brand-assets.mjs).
import logoOrange from "../../../public/brand/sanady-logo.png";
import logoLight from "../../../public/brand/sanady-logo-light.png";
import tagline from "../../../public/brand/sanady-tagline.png";
import smileHd from "../../../public/brand/sanady-smile.png";
import { cn } from "@/lib/cn";

/**
 * Official Fondation Sanady logo.
 * Supports:
 * - `variant="default"` : Official dual-tone logo.
 * - `variant="orange"`  : Upgraded vibrant orange edition.
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
  const src = variant === "light" ? logoLight : variant === "orange" ? logoOrange : logo;
  return (
    <Image
      src={src}
      alt="Fondation Sanady"
      priority={priority}
      className={cn("h-9 w-auto select-none", className)}
      sizes="(min-width: 1024px) 220px, 160px"
    />
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

