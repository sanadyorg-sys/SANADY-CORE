import Link from "next/link";
import { ArrowRight, CalendarClock, MapPin } from "lucide-react";
import { FIELD_ICONS } from "@/components/partnerships/field-icons";
import { formatDate } from "@/lib/format";
import { CONTRIBUTION_TYPES, INTERVENTION_FIELDS, formatAmount, type PublicOpportunity } from "@/lib/partnerships";
import { cn } from "@/lib/cn";

/** Public card of a project seeking partners (published by the Foundation). */
export function OpportunityCard({ opportunity: o }: { opportunity: PublicOpportunity }) {
  const Icon = FIELD_ICONS[o.intervention_field];
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-caption font-semibold text-accent-800">
          <Icon className="size-4" aria-hidden /> {INTERVENTION_FIELDS[o.intervention_field]?.name}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-caption font-semibold",
            o.open ? "bg-success-50 text-success-700" : "bg-ink-100 text-ink-600",
          )}
        >
          {o.open ? "Ouvert" : "Clôturé"}
        </span>
      </div>
      <h3 className="mt-3 text-section font-bold leading-snug text-ink-900">
        <Link href={`/partenariats/opportunites/${o.reference}`} className="after:absolute after:inset-0 group-hover:text-accent-800 focus-visible:outline-none">
          {o.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-3 text-body leading-relaxed text-ink-600">{o.summary}</p>
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {o.contribution_types.map((c) => (
          <li key={c} className="rounded-md bg-ink-50 px-2 py-0.5 text-caption font-medium text-ink-700">
            {CONTRIBUTION_TYPES[c]}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-5 text-caption text-ink-600">
        {o.geographic_scope ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-ink-500" aria-hidden /> {o.geographic_scope}
          </span>
        ) : null}
        {o.deadline && o.open ? (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5 text-ink-500" aria-hidden /> Jusqu’au {formatDate(o.deadline)}
          </span>
        ) : null}
        {o.funding_target ? <span className="font-semibold text-ink-800">{formatAmount(o.funding_target, o.currency)}</span> : null}
        <ArrowRight className="ml-auto size-4 text-accent-700 transition-transform group-hover:translate-x-1" aria-hidden />
      </div>
    </article>
  );
}
