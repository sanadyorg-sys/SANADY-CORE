import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  Handshake,
  Info,
  Layers,
  MonitorPlay,
  PenTool,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BrandDots } from "@/components/brand/brand-decor";
import { EnterpriseRequestForm } from "@/components/enterprise/request-form";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { ENTERPRISE_SERVICES, type EnterpriseService } from "@/lib/enterprise";
import { FOUNDATION } from "@/lib/institution";

/**
 * SANADY Enterprise public portal (brief V3 §5). PROPOSED services: hidden
 * (no menu link, noindex) and worded as proposals until the Foundation's
 * governance approvals (docs/enterprise/plan.md §1). Only verified facts
 * about the Foundation and features the platform really has.
 */
export const metadata: Metadata = {
  title: "SANADY Enterprise — formation professionnelle",
  description: "Projet de services de formation professionnelle de la Fondation Sanady pour les organisations.",
  robots: { index: false, follow: false },
};

const RELATIONSHIPS: Array<{ icon: LucideIcon; title: string; kind: string; text: string; href: string; cta: string }> = [
  {
    icon: Handshake,
    title: "Partenariats solidaires",
    kind: "Soutien à la mission",
    text: "Votre organisation contribue — financement, expertise, équipement, coopération — aux programmes éducatifs de la Fondation. Il ne s’agit pas d’un achat de service.",
    href: "/partenariats#candidature",
    cta: "Proposer un partenariat",
  },
  {
    icon: PenTool,
    title: "Formation professionnelle sur mesure",
    kind: "Service (en projet)",
    text: "La Fondation conçoit un parcours adapté à vos équipes : analyse des besoins, contenus, vidéos, évaluations, attestations et suivi.",
    href: "#demande",
    cta: "Demander une formation sur mesure",
  },
  {
    icon: MonitorPlay,
    title: "Plateforme de formation pour entreprises",
    kind: "Service (en projet)",
    text: "Vos collaborateurs suivent vos propres formations dans un espace sécurisé et séparé de la plateforme SANADY.",
    href: "#plateforme",
    cta: "Découvrir la plateforme",
  },
  {
    icon: Layers,
    title: "Coopération hybride",
    kind: "Combinaison",
    text: "Formation, plateforme et partenariat peuvent se combiner, chacun faisant l’objet d’un accord distinct : un achat de service n’est jamais un don.",
    href: "#demande",
    cta: "En parler avec nous",
  },
];

const PLATFORM: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Building2, title: "Un espace par organisation", text: "Vos collaborateurs, vos formations et vos résultats restent séparés de tout autre utilisateur." },
  { icon: MonitorPlay, title: "Vidéos et documents", text: "Leçons vidéo et PDF consultables sur ordinateur, tablette et téléphone, avec reprise là où l’on s’est arrêté." },
  { icon: ClipboardCheck, title: "Évaluations", text: "Questionnaires corrigés automatiquement, avec seuil de réussite et nombre de tentatives définis par accord." },
  { icon: Award, title: "Attestations vérifiables", text: "Attestation de suivi délivrée à la fin du parcours, vérifiable en ligne par QR code." },
  { icon: BarChart3, title: "Suivi et rapports", text: "Progression par collaborateur, taux de réussite, exports pour vos équipes RH." },
  { icon: ShieldCheck, title: "Sécurité", text: "Accès sur invitation, connexion en deux étapes pour les administrateurs, données hébergées en Europe." },
];

const STEPS = [
  "Vous décrivez votre besoin avec le formulaire ci-dessous.",
  "L’équipe étudie la faisabilité et vous propose un échange.",
  "Une proposition détaillée est préparée, puis validée par la Fondation.",
  "Après accord formel, la formation est produite ou l’espace mis en place.",
];

const FAQ = [
  {
    q: "Ces services sont-ils déjà proposés ?",
    a: "Non. Il s’agit d’un projet de la Fondation Sanady, soumis à la validation de ses instances. Votre demande nous aide à l’étudier ; elle n’engage ni votre organisation ni la Fondation.",
  },
  {
    q: "Quelle différence avec un partenariat ?",
    a: "Un partenariat soutient les programmes éducatifs de la Fondation (don, mécénat, expertise, équipement). Une formation ou un espace de formation est un service : les deux font l’objet d’accords distincts et ne sont jamais confondus.",
  },
  {
    q: "Nos données et celles de nos collaborateurs sont-elles protégées ?",
    a: "Chaque organisation dispose d’un espace séparé : aucune autre organisation ni aucun autre utilisateur n’y a accès. Les conditions de traitement des données sont précisées dans l’accord.",
  },
  {
    q: "Comment les prix sont-ils établis ?",
    a: "Selon le besoin : analyse, conception, production vidéo, nombre d’apprenants, accès à la plateforme, support. Chaque proposition est détaillée ligne par ligne et validée par la Fondation.",
  },
];

export default async function EnterprisePage(props: PageProps<"/partenariats/entreprises">) {
  const sp = await props.searchParams;
  const service = typeof sp.service === "string" && sp.service in ENTERPRISE_SERVICES ? (sp.service as EnterpriseService) : undefined;

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots-light opacity-15" />
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[36rem] rounded-full bg-accent-600/20 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3.5 py-1 text-label font-semibold uppercase tracking-[0.18em] text-accent-400">
            <BrandDots /> SANADY Enterprise
          </p>
          <h1 className="mt-5 max-w-3xl text-[2.25rem] font-extrabold leading-[1.12] tracking-tight sm:text-[3rem]">
            La formation professionnelle au service des organisations et du développement des compétences.
          </h1>
          <p className="mt-6 max-w-2xl text-[1.125rem] leading-relaxed text-brand-100">
            Concevez des parcours de formation adaptés à vos équipes ou bénéficiez d’un environnement numérique sécurisé pour accompagner leur montée en
            compétences.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/partenariats/entreprises?service=sur_mesure#demande" className={buttonClasses({ variant: "brand", size: "xl", className: "rounded-xl" })}>
              Demander une formation sur mesure <ArrowRight aria-hidden />
            </Link>
            <a href="#plateforme" className={buttonClasses({ size: "xl", className: "rounded-xl border-2 border-white/70 bg-white/5! font-bold text-white hover:bg-white/15!" })}>
              Découvrir la plateforme
            </a>
            <Link href="/partenariats#candidature" className={buttonClasses({ size: "xl", className: "rounded-xl font-bold text-white underline-offset-4 hover:underline" })}>
              Proposer un partenariat
            </Link>
          </div>
        </div>
      </section>

      {/* Honest status: a proposal, not an existing offer (brief V3 §2). */}
      <div className="border-b border-warning-200 bg-warning-50">
        <p className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-4 text-body text-warning-700 sm:px-6 lg:px-8">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            <strong>Services en projet.</strong> Ces services de formation pour les organisations sont étudiés par la Fondation Sanady et soumis à la
            validation de ses instances. Ils ne sont pas encore proposés : une demande ne vaut ni offre ni engagement.
          </span>
        </p>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Quatre façons de travailler ensemble
          </p>
          <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Soutenir la mission ou former vos équipes</h2>
          <p className="mt-2 text-reading text-ink-600">Les dons et partenariats d’une part, les services de formation d’autre part, restent strictement distincts.</p>
        </Reveal>
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {RELATIONSHIPS.map((r, i) => (
            <Reveal as="li" key={r.title} delay={i * 60} className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                  <r.icon className="size-6" aria-hidden />
                </span>
                <span className="rounded-full bg-ink-50 px-2.5 py-0.5 text-caption font-semibold text-ink-700">{r.kind}</span>
              </div>
              <h3 className="mt-4 text-section font-bold text-ink-900">{r.title}</h3>
              <p className="mt-2 flex-1 text-body leading-relaxed text-ink-600">{r.text}</p>
              <Link href={r.href} className="mt-4 inline-flex items-center gap-1.5 text-label font-bold text-accent-700 hover:underline">
                {r.cta} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Reveal>
          ))}
        </ul>
      </section>

      <section id="plateforme" className="scroll-mt-20 border-y border-line bg-ink-25 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> La plateforme SANADY
            </p>
            <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Une infrastructure déjà utilisée pour former les enseignants</h2>
            <p className="mt-2 text-reading text-ink-600">
              Les fonctionnalités ci-dessous existent aujourd’hui sur la plateforme de formation continue de la Fondation ; leur ouverture aux organisations
              est à l’étude.
            </p>
          </Reveal>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM.map((p, i) => (
              <Reveal as="li" key={p.title} delay={i * 50} className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
                <p.icon className="mt-0.5 size-5 shrink-0 text-accent-700" aria-hidden />
                <span>
                  <span className="block text-card font-bold text-ink-900">{p.title}</span>
                  <span className="mt-1 block text-body text-ink-600">{p.text}</span>
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="text-[1.75rem] font-extrabold tracking-tight text-ink-900">Comment se déroule une demande</h2>
          <ol className="mt-6 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-label font-bold text-accent-800">{i + 1}</span>
                <span className="text-body text-ink-700">{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-[1.75rem] font-extrabold tracking-tight text-ink-900">La Fondation Sanady</h2>
          <p className="mt-4 text-reading leading-relaxed text-ink-700">
            {FOUNDATION.status}, active depuis {FOUNDATION.since}. Elle accompagne les élèves et les enseignants de l’école publique et forme les
            enseignants grâce à sa plateforme de formation continue.
          </p>
          <p className="mt-4 flex items-center gap-2 text-body text-ink-700">
            <BookOpenCheck className="size-4 text-accent-700" aria-hidden />
            <Link href="/a-propos" className="font-medium text-accent-700 hover:underline">
              En savoir plus sur la Fondation
            </Link>
          </p>
          <p className="mt-2 flex items-center gap-2 text-body text-ink-700">
            <Users className="size-4 text-accent-700" aria-hidden /> Contact : <a href={`mailto:${FOUNDATION.email}`} className="font-medium text-accent-700 hover:underline">{FOUNDATION.email}</a>
          </p>
        </div>
      </section>

      <section id="demande" className="scroll-mt-20 border-t border-line bg-ink-25 py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
          <div>
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> Demande
            </p>
            <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Décrire votre besoin</h2>
            <p className="mt-3 text-reading leading-relaxed text-ink-600">
              Six étapes : organisation, contact, service, besoins de formation, documents éventuels, puis envoi. Vous recevez une référence de suivi. Cette
              demande n’engage aucune des deux parties.
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <EnterpriseRequestForm defaultService={service} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <h2 className="text-[1.75rem] font-extrabold tracking-tight text-ink-900">Questions fréquentes</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none text-card font-semibold text-ink-900 marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span aria-hidden className="text-accent-700 transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-body leading-relaxed text-ink-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
