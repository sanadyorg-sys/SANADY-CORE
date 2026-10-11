import Link from "next/link";
import { cn } from "@/lib/cn";
import { periodPresets, todayInMorocco, type Period } from "@/lib/period";

/** Period selection in one row: presets plus a custom range (GET form, works without JavaScript). */
export function PeriodFilter({ action, period }: { action: string; period: Period }) {
  const today = todayInMorocco();
  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4">
      <nav aria-label="Périodes prédéfinies" className="flex flex-wrap gap-1.5">
        {periodPresets(today).map((p) => (
          <Link
            key={p.key}
            href={`${action}?periode=${p.key}`}
            aria-current={period.preset === p.key ? "true" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-label font-medium transition-colors",
              period.preset === p.key ? "bg-brand-700 text-white" : "border border-line-strong text-ink-700 hover:bg-ink-50",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <form key={`${period.from}_${period.to}`} action={action} method="get" className="ml-auto flex flex-wrap items-end gap-2">
        <label className="text-caption font-medium text-ink-600">
          Du
          <input type="date" name="du" defaultValue={period.from} max={today} required className="mt-1 block h-9 rounded-md border border-line-strong bg-surface px-2 text-body text-ink-900" />
        </label>
        <label className="text-caption font-medium text-ink-600">
          Au
          <input type="date" name="au" defaultValue={period.to} max={today} required className="mt-1 block h-9 rounded-md border border-line-strong bg-surface px-2 text-body text-ink-900" />
        </label>
        <button type="submit" className="h-9 rounded-md border border-line-strong bg-surface px-3.5 text-body font-medium text-ink-800 shadow-xs hover:bg-ink-50">
          Appliquer
        </button>
      </form>
    </div>
  );
}
