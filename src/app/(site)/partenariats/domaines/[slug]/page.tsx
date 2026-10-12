import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { buttonClasses } from "@/components/ui/button";
import { FIELD_SLUGS, INTERVENTION_FIELDS, THEMES, fieldProgram, type InterventionField } from "@/lib/partnerships";
import { FIELD_ICONS } from "@/components/partnerships/field-icons";

/** One page per field of intervention (brief V2 §4). Hidden like /partenariats. */
export function generateStaticParams() {
  return FIELD_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/partenariats/domaines/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const field = INTERVENTION_FIELDS[slug as InterventionField];
  return { title: field ? `${field.name} · Partenariats` : "Partenariats", robots: { index: false, follow: false } };
}

export default async function FieldPage(props: PageProps<"/partenariats/domaines/[slug]">) {
  const { slug } = await props.params;
  if (!(slug in INTERVENTION_FIELDS)) notFound();
  const key = slug as InterventionField;
  const field = INTERVENTION_FIELDS[key];
  const program = fieldProgram(key);
  const Icon = FIELD_ICONS[key];

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots-light opacity-15" />
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <Link href="/partenariats#domaines" className="inline-flex items-center gap-1.5 text-label text-brand-200 hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> Partenariats &amp; Coopération
          </Link>
          <div className="mt-6 flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-accent-400">
              <Icon className="size-7" aria-hidden />
            </span>
            <p className="text-label font-semibold uppercase tracking-[0.18em] text-accent-400">{THEMES[field.theme]}</p>
          </div>
          <h1 className="mt-5 max-w-3xl text-[2.25rem] font-extrabold leading-[1.12] tracking-tight sm:text-[3rem]">{field.name}</h1>
          {program ? <p className="mt-5 max-w-2xl text-[1.125rem] leading-relaxed text-brand-100">{program.description}</p> : null}
          {program ? (
            <a href={program.href} className="mt-5 inline-flex items-center gap-1.5 text-label font-medium text-brand-200 hover:text-white hover:underline">
              Le programme sur sanady.org <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-16">
        <div>
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Contributions possibles
          </p>
          <h2 className="mt-2 text-[1.625rem] font-extrabold tracking-tight text-ink-900">Comment soutenir ce domaine</h2>
          <p className="mt-2 text-body text-ink-600">Exemples de coopération envisageables, à préciser avec l’équipe partenariats.</p>
          <ul className="mt-6 space-y-3">
            {field.contributions.map((c) => (
              <li key={c} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-body text-ink-800">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[1.625rem] font-extrabold tracking-tight text-ink-900">Projets à la recherche de partenaires</h2>
          <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-ink-25 p-8 text-center">
            <p className="text-body text-ink-700">Aucun projet n’est publié dans ce domaine pour le moment.</p>
            <p className="mt-1 text-caption text-ink-500">Les projets sont publiés après validation par la Fondation Sanady.</p>
          </div>
          <Link
            href={`/partenariats?domaine=${key}#candidature`}
            className={buttonClasses({ variant: "accent", size: "lg", className: "mt-6 rounded-xl" })}
          >
            Proposer un partenariat dans ce domaine <ArrowRight aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
