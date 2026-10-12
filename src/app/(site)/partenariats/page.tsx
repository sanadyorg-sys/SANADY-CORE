import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Handshake,
  Laptop,
  Mail,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { BrandDots, SmileUnderline } from "@/components/brand/brand-decor";
import { FIELD_ICONS } from "@/components/partnerships/field-icons";
import { PartnershipApplicationForm } from "@/components/partnerships/application-form";
import { OpportunityCard } from "@/components/partnerships/opportunity-card";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { FOUNDATION } from "@/lib/institution";
import { publicOpportunities } from "@/server/queries/partnerships";
import { CONTRIBUTION_TYPES, FIELD_SLUGS, INTERVENTION_FIELDS, THEMES, fieldProgram, type InterventionField } from "@/lib/partnerships";

/**
 * Public partnership portal (brief V2 §3). Hidden until the Foundation
 * approves it: no menu link and not indexed by search engines.
 * Content: verified facts only (src/lib/institution.ts, sanady.org).
 */
export const metadata: Metadata = {
  title: "Partenariats & Coopération",
  description: "Entreprises, universités, fondations et organisations : engagez-vous aux côtés de la Fondation Sanady pour soutenir des initiatives éducatives concrètes.",
  robots: { index: false, follow: false },
};

const CONTRIBUTION_ICONS: Record<keyof typeof CONTRIBUTION_TYPES, LucideIcon> = {
  financier: Handshake,
  equipement: Wrench,
  expertise: Users,
  technologie: Laptop,
  services_educatifs: Sparkles,
  cooperation_institutionnelle: Building2,
};

const CONTRIBUTION_TEXT: Record<keyof typeof CONTRIBUTION_TYPES, string> = {
  financier: "Mécénat ou financement d’un projet éducatif précis, avec un suivi de l’utilisation des fonds.",
  equipement: "Matériel pédagogique, mobilier, équipement informatique ou sportif pour les écoles.",
  expertise: "Intervenants, formateurs ou mentors issus de votre organisation.",
  technologie: "Outils numériques, infrastructure ou accompagnement technique.",
  services_educatifs: "Ateliers, contenus ou services directement utiles aux élèves et aux enseignants.",
  cooperation_institutionnelle: "Coopération entre institutions, universités, associations ou collectivités.",
};

const STEPS = [
  { title: "Vous présentez votre proposition", text: "Avec le formulaire ci-dessous, en quelques minutes." },
  { title: "L’équipe partenariats l’étudie", text: "Elle vous recontacte pour préciser le projet et ses objectifs." },
  { title: "La Fondation valide", text: "Le partenariat est soumis à une validation institutionnelle, puis formalisé par une convention." },
  { title: "Mise en œuvre et suivi", text: "Les actions sont suivies et leurs résultats partagés avec vous." },
];

const FAQ = [
  {
    q: "Qui peut proposer un partenariat ?",
    a: "Les entreprises, fondations, universités, associations, administrations et organisations internationales qui souhaitent soutenir les programmes éducatifs de la Fondation Sanady.",
  },
  {
    q: "Quels types de contribution sont possibles ?",
    a: "Un soutien financier, du matériel, de l’expertise, de la technologie, des services éducatifs ou une coopération institutionnelle, au service de l’un des six domaines d’intervention de la Fondation.",
  },
  {
    q: "Comment ma candidature est-elle étudiée ?",
    a: "L’équipe partenariats examine chaque proposition et vous recontacte. Tout engagement est soumis à la validation institutionnelle de la Fondation Sanady, puis formalisé par une convention.",
  },
  {
    q: "Mes informations sont-elles protégées ?",
    a: "Oui. Elles sont accessibles uniquement à l’équipe partenariats, et vos documents sont stockés de façon privée. Une proposition qui n’aboutit pas est supprimée au plus tard 24 mois après sa clôture.",
  },
  {
    q: "La Fondation publie-t-elle les noms de ses partenaires ?",
    a: "Uniquement avec l’accord écrit du partenaire concerné.",
  },
];

export default async function PartnershipsPage(props: PageProps<"/partenariats">) {
  const sp = await props.searchParams;
  const domaine = typeof sp.domaine === "string" && sp.domaine in INTERVENTION_FIELDS ? (sp.domaine as InterventionField) : undefined;
  const projects = await publicOpportunities();
  const open = projects.filter((o) => o.open);
  const projet = typeof sp.projet === "string" && open.some((o) => o.reference === sp.projet) ? sp.projet : undefined;
  const openByField = new Map<string, number>();
  for (const o of open) openByField.set(o.intervention_field, (openByField.get(o.intervention_field) ?? 0) + 1);

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots-light opacity-15" />
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[36rem] rounded-full bg-accent-600/20 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3.5 py-1 text-label font-semibold uppercase tracking-[0.18em] text-accent-400">
            <BrandDots /> Partenariats &amp; Coopération
          </p>
          <h1 className="mt-5 max-w-3xl text-[2.375rem] font-extrabold leading-[1.12] tracking-tight sm:text-[3.25rem]">
            Ensemble, construisons un <SmileUnderline className="text-accent-400">avenir éducatif</SmileUnderline> meilleur.
          </h1>
          <p className="mt-6 max-w-2xl text-[1.125rem] leading-relaxed text-brand-100">
            Entreprises, universités, fondations et organisations : engagez-vous aux côtés de SANADY pour soutenir des initiatives éducatives
            concrètes et contribuer à un impact durable.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#candidature" className={buttonClasses({ variant: "brand", size: "xl", className: "rounded-xl" })}>
              Proposer un partenariat <ArrowRight aria-hidden />
            </a>
            <a href="#domaines" className={buttonClasses({ size: "xl", className: "rounded-xl border-2 border-white/70 bg-white/5! font-bold text-white hover:bg-white/15!" })}>
              Nos domaines d’intervention
            </a>
          </div>
        </div>
      </section>

      {/* ─── Why ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:py-20">
        <Reveal>
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Pourquoi s’associer à la Fondation Sanady
          </p>
          <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Faire ensemble la différence</h2>
          <div className="mt-5 space-y-4 text-reading leading-relaxed text-ink-700">
            <p>
              {FOUNDATION.status}, la Fondation Sanady œuvre depuis {FOUNDATION.since} contre l’abandon et l’échec scolaires des élèves de
              l’école publique issus de milieux socio-économiques défavorisés, ruraux et péri-urbains.
            </p>
            <p>
              <strong className="text-ink-900">Sa vision :</strong> {FOUNDATION.vision}
            </p>
            <p>
              Afin de couvrir davantage de besoins socio-éducatifs, la Fondation recherche des partenariats « gagnant-gagnant » : chaque
              contribution est rattachée à un programme précis, validée par la Fondation et suivie.
            </p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <h3 className="text-section font-bold text-ink-900">Comment se construit un partenariat</h3>
          <ol className="mt-5 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-label font-bold text-accent-800">{i + 1}</span>
                <span>
                  <span className="block text-card font-bold text-ink-900">{s.title}</span>
                  <span className="mt-0.5 block text-body text-ink-600">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* ─── Six fields of intervention ───────────────────────────────────── */}
      <section id="domaines" className="scroll-mt-20 border-y border-line bg-ink-25 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> Six domaines d’intervention
            </p>
            <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Où votre engagement peut agir</h2>
            <p className="mt-2 text-reading text-ink-600">Les programmes de la Fondation Sanady, autour de l’apprentissage, de l’avenir et de l’éveil des élèves.</p>
          </Reveal>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FIELD_SLUGS.map((slug, i) => {
              const f = INTERVENTION_FIELDS[slug];
              const Icon = FIELD_ICONS[slug];
              const program = fieldProgram(slug);
              return (
                <Reveal as="li" key={slug} delay={i * 60}>
                  <Link
                    href={`/partenariats/domaines/${slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-accent-500/40 hover:shadow-md"
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex size-12 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                        <Icon className="size-6" aria-hidden />
                      </span>
                      <span className="text-caption font-semibold uppercase tracking-wider text-ink-500">{THEMES[f.theme]}</span>
                    </span>
                    <span className="mt-4 block text-section font-bold text-ink-900 group-hover:text-accent-800">{f.name}</span>
                    {program ? <span className="mt-2 line-clamp-3 block text-body leading-relaxed text-ink-600">{program.description}</span> : null}
                    {openByField.get(slug) ? (
                      <span className="mt-3 inline-flex w-fit rounded-full bg-success-50 px-2.5 py-0.5 text-caption font-semibold text-success-700">
                        {openByField.get(slug)} projet{openByField.get(slug)! > 1 ? "s" : ""} ouvert{openByField.get(slug)! > 1 ? "s" : ""} aux partenaires
                      </span>
                    ) : null}
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-label font-bold text-accent-700">
                      Découvrir ce domaine <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ─── Projects seeking partners (published by the Foundation) ─────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> Besoins validés par la Fondation
            </p>
            <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Projets à la recherche de partenaires</h2>
          </div>
          {open.length ? (
            <Link href="/partenariats/opportunites" className={buttonClasses({ variant: "secondary", className: "rounded-xl" })}>
              Tous les projets <ArrowRight aria-hidden />
            </Link>
          ) : null}
        </Reveal>
        {open.length ? (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {open.slice(0, 3).map((o) => (
              <li key={o.reference}>
                <OpportunityCard opportunity={o} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-3xl border border-dashed border-line-strong bg-surface p-8 text-center text-body text-ink-600">
            Aucun projet n’est publié pour le moment : vous pouvez dès maintenant proposer une coopération dans l’un des six domaines.
          </p>
        )}
      </section>

      {/* ─── Ways to contribute ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        <Reveal className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Façons de contribuer
          </p>
          <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Chaque organisation peut apporter quelque chose</h2>
        </Reveal>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CONTRIBUTION_TYPES) as Array<keyof typeof CONTRIBUTION_TYPES>).map((k, i) => {
            const Icon = CONTRIBUTION_ICONS[k];
            return (
              <Reveal as="li" key={k} delay={i * 50} className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
                <Icon className="mt-0.5 size-5 shrink-0 text-accent-700" aria-hidden />
                <span>
                  <span className="block text-card font-bold text-ink-900">{CONTRIBUTION_TYPES[k]}</span>
                  <span className="mt-1 block text-body text-ink-600">{CONTRIBUTION_TEXT[k]}</span>
                </span>
              </Reveal>
            );
          })}
        </ul>
      </section>

      {/* ─── Application ──────────────────────────────────────────────────── */}
      <section id="candidature" className="scroll-mt-20 border-t border-line bg-ink-25 py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
          <div>
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> Candidature
            </p>
            <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Proposer un partenariat</h2>
            <p className="mt-3 text-reading leading-relaxed text-ink-600">
              Cinq étapes : votre organisation, la personne de contact, votre proposition, vos documents éventuels, puis un récapitulatif avant
              l’envoi. Vous recevez une référence de suivi.
            </p>
            <p className="mt-6 flex items-center gap-2 text-body text-ink-700">
              <Mail className="size-4 text-accent-700" aria-hidden />
              Une question ? <a href={`mailto:${FOUNDATION.email}`} className="font-medium text-accent-700 hover:underline">{FOUNDATION.email}</a>
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <PartnershipApplicationForm defaultField={domaine} projects={open.map((o) => ({ reference: o.reference, title: o.title }))} defaultProject={projet} />
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="text-[1.75rem] font-extrabold tracking-tight text-ink-900">Questions fréquentes</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none text-card font-semibold text-ink-900 marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span aria-hidden className="text-accent-700 transition-transform duration-200 group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-body leading-relaxed text-ink-600">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-body text-ink-600">
          Contact institutionnel : <a href={`mailto:${FOUNDATION.email}`} className="font-medium text-accent-700 hover:underline">{FOUNDATION.email}</a> ·{" "}
          <a href={FOUNDATION.contactUrl} className="font-medium text-accent-700 hover:underline">
            page contact de sanady.org
          </a>
        </p>
      </section>
    </>
  );
}
