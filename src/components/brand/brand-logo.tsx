import Image from "next/image";
import logo from "../../../public/brand/sanady-logo.png";
import logoLight from "../../../public/brand/sanady-logo-light.png";
import tagline from "../../../public/brand/sanady-tagline.png";
import { cn } from "@/lib/cn";

/**
 * Official Fondation Sanady logo (extracted from the banner supplied by the
 * foundation — see scripts/brand/extract-brand-assets.mjs). Never recolour,
 * stretch or crop it: size it by height only and keep clear space around it
 * equal to at least the height of the orange dots.
 *
 * `variant="light"` is the approved adaptation for dark backgrounds
 * (black → white, orange unchanged).
 */
export function BrandLogo({
  variant = "default",
  className,
  priority = false,
}: {
  variant?: "default" | "light";
  /** Set the height (e.g. "h-9"); width follows the logo's proportions. */
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={variant === "light" ? logoLight : logo}
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
