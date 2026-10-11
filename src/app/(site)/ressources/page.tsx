import type { Metadata } from "next";
import { ArrowUpRight, BookOpenCheck, FileText, Globe } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { FOUNDATION, MALLETTE, PROGRAM_GROUPS, PUBLICATIONS, SANADY_SITE } from "@/lib/institution";

export const metadata: Metadata = {
  title: "Ressources institutionnelles",
  description: "Rapports annuels, brochure, mallette pédagogique et liens officiels de la Fondation Sanady.",
};

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export default function ResourcesPage() {
  return (
    <>
      <section className="border-b border-line bg-ink-25">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-label font-semibold uppercase tracking-wider text-accent-700">Fondation Sanady</p>
          <h1 className="mt-2 text-[2.25rem] font-extrabold leading-tight tracking-tight text-ink-900">Ressources institutionnelles</h1>
          <p className="mt-3 max-w-2xl text-reading text-ink-600">
            Publications, ressources pédagogiques et liens officiels de la Fondation. Les documents sont hébergés sur le site officiel{" "}
            <a href={SANADY_SITE} className="font-medium text-accent-700 hover:underline" {...external}>
              sanady.org
            </a>
            , qui en reste la source de référence.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* ─── Mallette ─────────────────────────────────────────────────── */}
        <section aria-labelledby="mallette" className="grid gap-6 rounded-2xl border border-line bg-surface p-7 sm:p-9 md:grid-cols-[auto_1fr_auto] md:items-center">
          <span className="flex size-14 items-center justify-center rounded-xl bg-accent-500 text-white">
            <BookOpenCheck className="size-7" aria-hidden />
          </span>
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-accent-700">Ressource pédagogique</p>
            <h2 id="mallette" className="mt-1 text-[1.375rem] font-bold text-ink-900">
              {MALLETTE.title}
            </h2>
            <p className="mt-2 max-w-3xl text-body leading-relaxed text-ink-600">{MALLETTE.description}</p>
          </div>
          <a href={MALLETTE.href} className={buttonClasses({ variant: "accent", size: "lg" })} {...external}>
            Accéder à la mallette <ArrowUpRight aria-hidden />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
        </section>

        {/* ─── Publications ─────────────────────────────────────────────── */}
        <section aria-labelledby="publications">
          <h2 id="publications" className="text-[1.5rem] font-bold text-ink-900">
            Publications officielles
          </h2>
          <p className="mt-1 text-body text-ink-600">Rapports d’activité et documents de présentation publiés par la Fondation.</p>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PUBLICATIONS.map((p) => (
              <li key={p.href} className="flex flex-col rounded-xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <FileText className="size-6 text-accent-700" aria-hidden />
                  <span className="rounded-md bg-ink-100 px-2 py-0.5 text-caption font-semibold text-ink-700">{p.format}</span>
                </div>
                <p className="mt-4 text-caption font-semibold uppercase tracking-wider text-ink-500">{p.kind}</p>
                <h3 className="mt-1 text-card font-semibold text-ink-900">{p.title}</h3>
                <p className="mt-1.5 flex-1 text-body leading-relaxed text-ink-600">{p.description}</p>
                <dl className="mt-4 space-y-0.5 border-t border-line pt-3 text-caption text-ink-500">
                  <div className="flex gap-1.5">
                    <dt>Année :</dt>
                    <dd className="text-ink-700">{p.year ?? "non précisée"}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Source :</dt>
                    <dd className="text-ink-700">Fondation Sanady — sanady.org</dd>
                  </div>
                </dl>
                <a href={p.href} className="mt-4 inline-flex items-center gap-1 text-label font-medium text-accent-700 hover:underline" {...external}>
                  Consulter le document <ArrowUpRight className="size-3.5" aria-hidden />
                  <span className="sr-only">(PDF, nouvel onglet)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Official links ───────────────────────────────────────────── */}
        <section aria-labelledby="liens">
          <h2 id="liens" className="text-[1.5rem] font-bold text-ink-900">
            Liens officiels
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              <li className="px-5 py-3.5">
                <a href={FOUNDATION.presentationUrl} className="flex items-center justify-between gap-3 text-body font-medium text-ink-800 hover:text-accent-700" {...external}>
                  Présentation de la Fondation <ArrowUpRight className="size-4 shrink-0" aria-hidden />
                </a>
              </li>
              {PROGRAM_GROUPS.flatMap((g) => g.programs).map((p) => (
                <li key={p.href} className="px-5 py-3.5">
                  <a href={p.href} className="flex items-center justify-between gap-3 text-body font-medium text-ink-800 hover:text-accent-700" {...external}>
                    {p.name} <ArrowUpRight className="size-4 shrink-0" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-line bg-surface p-6">
              <Globe className="size-6 text-accent-700" aria-hidden />
              <h3 className="mt-3 text-card font-semibold text-ink-900">Suivre la Fondation</h3>
              <ul className="mt-3 space-y-2">
                {FOUNDATION.social.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} className="text-body font-medium text-accent-700 hover:underline" {...external}>
                      {s.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a href={`mailto:${FOUNDATION.email}`} className="text-body font-medium text-accent-700 hover:underline">
                    {FOUNDATION.email}
                  </a>
                </li>
              </ul>
              <p className="mt-5 text-caption text-ink-500">Informations relevées sur sanady.org le 9 octobre 2026.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
