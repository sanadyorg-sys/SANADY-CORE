import { Slot } from "radix-ui";
import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "brand" | "accent" | "accent-outline" | "secondary" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon" | "icon-sm";

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium " +
  "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55 " +
  "[&_svg]:shrink-0 [&_svg]:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-xs",
  // Exact logo orange #F95A05 — use ONLY with size "xl" (19 px bold = large
  // text, where 3.2:1 meets WCAG AA). Use "accent" for smaller buttons.
  brand: "bg-accent-500 text-white font-bold! hover:bg-accent-600 active:bg-accent-700 shadow-xs",
  accent: "bg-accent-700 text-white hover:bg-accent-800 active:bg-accent-900 shadow-xs",
  "accent-outline": "bg-surface text-accent-700 border border-accent-600/70 hover:bg-accent-50 active:bg-accent-100",
  secondary:
    "bg-surface text-ink-800 border border-line-strong hover:bg-ink-50 hover:border-ink-400 active:bg-ink-100 shadow-xs",
  ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200",
  danger: "bg-danger-600 text-white hover:bg-danger-700 shadow-xs",
  "danger-ghost": "text-danger-600 hover:bg-danger-50",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-label [&_svg]:size-3.5",
  md: "h-9 px-3.5 text-body [&_svg]:size-4",
  lg: "h-11 px-5 text-[0.9375rem] [&_svg]:size-[1.125rem]",
  xl: "h-12 px-6 text-[1.1875rem] [&_svg]:size-5",
  icon: "size-9 [&_svg]:size-[1.125rem]",
  "icon-sm": "size-8 [&_svg]:size-4",
};

export function buttonClasses({ variant = "primary", size = "md", className }: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Renders the child element (e.g. a Link) with button styles. */
  asChild?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  className,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = buttonClasses({ variant, size, className });
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
