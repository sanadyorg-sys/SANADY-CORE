import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, MapPin } from "lucide-react";
import { FIELD_ICONS } from "@/components/partnerships/field-icons";
import { buttonClasses } from "@/components/ui/button";
import { DescriptionList } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { CONTRIBUTION_TYPES, INTERVENTION_FIELDS, formatAmount } from "@/lib/partnerships";
import { publicOpportunities } from "@/server/queries/partnerships";

async function find(reference: string) {
  return (await publicOpportunities()).find((o) => o.reference === reference) ?? null;
}

export async function generateMetadata(props: PageProps<"/partenariats/opportunites/[reference]">): Promise<Metadata> {
  const o = await find((await props.params).reference);
  return { title: o ? `${o.title} · Partenariats` : "Projet introuvable", robots: { index: false, follow: false } };
}

export default async function OpportunityPublicPage(props: PageProps<"/partenariats/opportunites/[reference]">) {
  const o = await find((await props.params).reference);
  if (!o) notFound();
  const Icon = FIELD_ICONS[o.intervention_field];

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots-light opacity-15" />
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <Link href="/partenariats/opportunites" className="inline-flex items-center gap-1.5 text-label text-brand-200 hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> Tous les projets
          </Link>
          <p className="mt-5 inline-flex items-center gap-2 text-label font-semibold uppercase tracking-[0.14em] text-accent-400">
            <Icon className="size-4" aria-hidden /> {INTERVENTION_FIELDS[o.intervention_field]?.name}
          </p>
          <h1 className="mt-3 max-w-3xl text-[2.125rem] font-extrabold leading-[1.12] tracking-tight sm:text-[2.75rem]">{o.title}</h1>
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-brand-100">{o.summary}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-label text-brand-200">
            <span className={o.open ? "rounded-full bg-success-600/20 px-2.5 py-0.5 font-semibold text-success-50" : "rounded-full bg-white/10 px-2.5 py-0.5 font-semibold"}>
              {o.open ? "Ouvert aux partenaires" : "Clôturé"}
            </span>
            {o.geographic_scope ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden /> {o.geographic_scope}
              </span>
            ) : null}
            {o.deadline && o.open ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" aria-hidden /> Candidatures jusqu’au {formatDate(o.deadline)}
              </span>
            ) : null}
            <span className="font-mono text-caption">{o.reference}</span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="min-w-0 space-y-8">
          {[
            ["Le projet", o.description],
            ["Objectifs éducatifs", o.objectives],
            ["Contribution attendue", o.expected_contribution],
            ["Expertise ou ressources nécessaires", o.required_resources],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <h2 className="text-section font-bold text-ink-900">{k}</h2>
                <p className="mt-2 whitespace-pre-line text-reading leading-relaxed text-ink-700">{v}</p>
              </div>
            ))}
        </div>
        <aside className="space-y-5 self-start rounded-3xl border border-line bg-surface p-6 shadow-sm">
          <DescriptionList
            items={[
              { term: "Bénéficiaires", value: o.beneficiaries },
              { term: "Contributions recherchées", value: o.contribution_types.map((c) => CONTRIBUTION_TYPES[c]).join(", ") },
              ...(o.funding_target ? [{ term: "Objectif de financement", value: formatAmount(o.funding_target, o.currency) }] : []),
              ...(o.timeline ? [{ term: "Calendrier", value: o.timeline }] : []),
              ...(o.department ? [{ term: "Département SANADY", value: o.department }] : []),
            ]}
          />
          {o.open ? (
            <Link href={`/partenariats?projet=${o.reference}#candidature`} className={buttonClasses({ variant: "accent", size: "lg", className: "w-full rounded-xl" })}>
              Proposer une contribution <ArrowRight aria-hidden />
            </Link>
          ) : (
            <p className="rounded-xl bg-ink-50 p-4 text-body text-ink-700">Ce projet n’accepte plus de candidatures.</p>
          )}
          <p className="text-caption text-ink-500">Projet validé par la Fondation Sanady. Tout engagement est formalisé par une convention.</p>
        </aside>
      </section>
    </>
  );
}
