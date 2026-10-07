import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/* ─── Card ─────────────────────────────────────────────────────────────── */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-surface shadow-xs", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-card font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-0.5 text-label text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-line bg-ink-25 px-5 py-3", className)}
      {...props}
    />
  );
}

/* ─── Badge ────────────────────────────────────────────────────────────── */

export type BadgeTone = "neutral" | "navy" | "teal" | "success" | "warning" | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  navy: "bg-navy-50 text-navy-700 ring-navy-100",
  teal: "bg-teal-50 text-teal-800 ring-teal-100",
  success: "bg-success-50 text-success-700 ring-success-600/15",
  warning: "bg-warning-50 text-warning-700 ring-warning-200",
  danger: "bg-danger-50 text-danger-700 ring-danger-200",
};

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-caption font-medium ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden /> : null}
      {children}
    </span>
  );
}

/* ─── Alert (inline callout) ───────────────────────────────────────────── */

const alertTones = {
  info: { box: "border-navy-100 bg-navy-50 text-navy-800", icon: Info },
  success: { box: "border-success-600/20 bg-success-50 text-success-700", icon: CircleCheck },
  warning: { box: "border-warning-200 bg-warning-50 text-warning-700", icon: TriangleAlert },
  danger: { box: "border-danger-200 bg-danger-50 text-danger-700", icon: CircleAlert },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof alertTones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = alertTones[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-md border px-4 py-3 text-body", box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "[&_a]:font-medium [&_a]:underline")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

/* ─── Page header ──────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {eyebrow ? <div className="mb-2 text-label text-ink-500">{eyebrow}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-title font-semibold text-ink-900">{title}</h1>
          {description ? <p className="mt-1 text-body text-ink-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

/* ─── Section heading ──────────────────────────────────────────────────── */

export function SectionHeading({ title, description, actions }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-section font-semibold text-ink-900">{title}</h2>
        {description ? <p className="text-label text-ink-500">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/* ─── Stat tile ────────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-label font-medium text-ink-600">{label}</p>
        {Icon ? <Icon className="size-4 text-ink-400" aria-hidden /> : null}
      </div>
      <p className="tabular mt-2 text-stat font-semibold text-ink-900">{value}</p>
      {detail ? <p className="mt-1 text-caption text-ink-500">{detail}</p> : null}
    </Card>
  );
}

/* ─── Description list ─────────────────────────────────────────────────── */

export function DescriptionList({ items, className }: {
  items: Array<{ term: ReactNode; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="text-label font-medium text-ink-500">{item.term}</dt>
          <dd className="text-body text-ink-900 sm:col-span-2">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
