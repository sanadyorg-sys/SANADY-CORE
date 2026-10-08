import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ─── Progress bar ─────────────────────────────────────────────────────── */

export function ProgressBar({
  value,
  label,
  tone = "accent",
  size = "md",
  showValue = false,
  className,
}: {
  /** 0 → 1 */
  value: number;
  label: string;
  tone?: "accent" | "brand" | "success";
  size?: "sm" | "md";
  showValue?: boolean;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill = { accent: "bg-accent-500", brand: "bg-brand-600", success: "bg-success-600" }[tone];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={cn("relative w-full overflow-hidden rounded-full bg-ink-100", size === "sm" ? "h-1.5" : "h-2")}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${pct}%` }} />
      </div>
      {showValue ? <span className="tabular min-w-12 shrink-0 whitespace-nowrap text-right text-label font-medium text-ink-700">{pct}&nbsp;%</span> : null}
    </div>
  );
}

/* ─── Progress ring (compact per-lesson indicator) ────────────────────── */

export function ProgressRing({ value, size = 28, label }: { value: number; size?: number; label: string }) {
  const pct = Math.min(1, Math.max(0, value));
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink-200" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className="stroke-accent-600 transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-md bg-ink-100 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.6),transparent)] bg-[length:400px_100%] bg-no-repeat animate-shimmer",
        className,
      )}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Chargement en cours">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

/* ─── Empty state ──────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {Icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-line bg-ink-25 text-ink-500">
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="text-card font-semibold text-ink-900">{title}</p>
      {description ? <p className="mt-1 max-w-md text-body text-ink-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
