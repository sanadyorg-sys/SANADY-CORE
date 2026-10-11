import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Compass,
  FileText,
  HeartHandshake,
  Landmark,
  Lightbulb,
  Mail,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { FOUNDATION, PROGRAM_GROUPS } from "@/lib/institution";
import { createClient } from "@/lib/supabase/server";
import classroom from "../../../../public/brand/sanady-classroom.jpg";

export const metadata: Metadata = {
  title: "À propos",
  description: "La Fondation Sanady et SANADY, sa plateforme de formation continue des enseignants.",
};

/** Commitments of this platform (project decisions, not Foundation values). */
const COMMITMENTS = [
  { icon: Lightbulb, title: "Utile en classe", text: "Des contenus courts, concrets et directement applicables avec vos élèves." },
  { icon: HeartHandshake, title: "Bienveillance", text: "L’erreur fait partie de l’apprentissage — pour les élèves comme pour les enseignants." },
  { icon: ShieldCheck, title: "Respect des données", text: "Vos formations personnelles restent privées ; vous décidez de rejoindre un établissement." },
  { icon: Sparkles, title: "Exigence", text: "Des évaluations à chaque module et un certificat qui atteste d’un parcours réellement suivi." },
];

const GROUP_ICONS: Record<string, LucideIcon> = { apprentissage: BookOpen, avenir: Compass, eveil: Sprout };

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export default async function AboutPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_platform_info");
  const supportEmail = (data as { support_email?: string | null } | null)?.support_email;

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-brand-800">
        <Image src={classroom} alt="" fill priority placeholder="blur" className="-z-10 object-cover opacity-35" sizes="100vw" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(12_10_9/0.92)_0%,rgb(12_10_9/0.6)_60%,rgb(12_10_9/0.3)_100%)]" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <p className="text-label font-semibold uppercase tracking-[0.2em] text-accent-500">À propos</p>
          <h1 className="mt-4 max-w-3xl text-[2.5rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[3.25rem]">
            Préparons les adultes du Maroc de demain.
          </h1>
          <p className="mt-6 max-w-2xl text-[1.125rem] leading-relaxed text-white/90">
            SANADY est la plateforme de formation continue des enseignants de la Fondation Sanady, {FOUNDATION.status.toLowerCase()},
            engagée depuis {FOUNDATION.since} pour la réussite des élèves de l’école publique.
          </p>
        </div>
      </section>

      {/* ─── Foundation ───────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:py-20">
        <div>
          <p className="text-label font-semibold uppercase tracking-wider text-accent-700">La Fondation</p>
          <h2 className="mt-2 text-[1.875rem] font-bold leading-tight tracking-tight text-ink-900">{FOUNDATION.name}</h2>
          <div className="mt-5 space-y-5 text-reading text-ink-700">
            <p>
              La Fondation Sanady est une association marocaine reconnue d’utilité publique. {FOUNDATION.summary}
            </p>
            <figure className="border-l-4 border-accent-500 pl-5">
              <figcaption className="text-label font-semibold uppercase tracking-wider text-ink-500">Mission</figcaption>
              <blockquote className="mt-1 text-ink-800">« {FOUNDATION.mission} »</blockquote>
            </figure>
            <figure className="border-l-4 border-accent-500 pl-5">
              <figcaption className="text-label font-semibold uppercase tracking-wider text-ink-500">Vision</figcaption>
              <blockquote className="mt-1 text-ink-800">« {FOUNDATION.vision} »</blockquote>
            </figure>
            <p className="text-label text-ink-500">
              Source :{" "}
              <a href={FOUNDATION.presentationUrl} className="font-medium text-accent-700 hover:underline" {...external}>
                sanady.org — Présentation
              </a>
            </p>
          </div>
        </div>
        <div>
          <h2 className="text-section font-semibold text-ink-900">Les engagements de la plateforme</h2>
          <p className="mt-1 text-body text-ink-600">Ce que SANADY garantit aux enseignants qui s’y forment.</p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {COMMITMENTS.map((v) => (
              <li key={v.title} className="rounded-xl border border-line bg-surface p-5">
                <v.icon className="size-6 text-accent-700" aria-hidden />
                <h3 className="mt-3 text-card font-semibold text-ink-900">{v.title}</h3>
                <p className="mt-1.5 text-body leading-relaxed text-ink-600">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Programs ─────────────────────────────────────────────────────── */}
      <section id="programmes" className="scroll-mt-24 border-y border-line bg-ink-25">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-label font-semibold uppercase tracking-wider text-accent-700">Champs d’intervention</p>
            <h2 className="mt-2 text-[1.875rem] font-bold leading-tight tracking-tight text-ink-900">Les programmes de la Fondation</h2>
            <p className="mt-3 text-reading text-ink-600">
              Sur le terrain, la Fondation accompagne les élèves autour de trois axes. La plateforme SANADY prolonge le programme de
              formation continue des enseignants.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {PROGRAM_GROUPS.map((group) => {
              const Icon = GROUP_ICONS[group.key] ?? BookOpen;
              return (
                <section key={group.key} aria-labelledby={`groupe-${group.key}`} className="flex flex-col rounded-2xl border border-line bg-surface">
                  <header className="flex items-center gap-3 border-b border-line px-6 py-5">
                    <span className="flex size-11 items-center justify-center rounded-lg bg-accent-500 text-white">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 id={`groupe-${group.key}`} className="text-section font-bold uppercase tracking-wide text-ink-900">
                        {group.title}
                      </h3>
                      <p className="text-label text-ink-500">{group.subtitle}</p>
                    </div>
                  </header>
                  <ul className="flex-1 divide-y divide-line">
                    {group.programs.map((p) => (
                      <li key={p.name} className="px-6 py-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-card font-semibold text-ink-900">{p.name}</h4>
                          {p.platform ? (
                            <span className="rounded-full bg-accent-50 px-2 py-0.5 text-caption font-semibold text-accent-800">Plateforme SANADY</span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-body leading-relaxed text-ink-600">{p.description}</p>
                        <a href={p.href} className="mt-2 inline-flex items-center gap-1 text-label font-medium text-accent-700 hover:underline" {...external}>
                          En savoir plus sur sanady.org <ArrowUpRight className="size-3.5" aria-hidden />
                          <span className="sr-only">(nouvel onglet)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Governance ───────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8 lg:py-20">
        <div className="rounded-2xl border border-line p-7">
          <Landmark className="size-6 text-accent-700" aria-hidden />
          <h2 className="mt-3 text-section font-semibold text-ink-900">Gouvernance</h2>
          <p className="mt-2 text-body leading-relaxed text-ink-600">{FOUNDATION.governance}</p>
        </div>
        <div className="rounded-2xl border border-line p-7">
          <Users className="size-6 text-accent-700" aria-hidden />
          <h2 className="mt-3 text-section font-semibold text-ink-900">Organisation</h2>
          <p className="mt-2 text-body leading-relaxed text-ink-600">{FOUNDATION.organisation}</p>
        </div>
      </section>

      {/* ─── Institutions ─────────────────────────────────────────────────── */}
      <section id="etablissements" className="scroll-mt-24 bg-ink-25">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-label font-semibold uppercase tracking-wider text-accent-700">Établissements partenaires</p>
            <h2 className="mt-2 text-[1.875rem] font-bold leading-tight tracking-tight text-ink-900">Un espace dédié à votre établissement</h2>
            <p className="mt-3 text-reading text-ink-600">
              La Fondation Sanady autorise des formations pour votre établissement. Vous les affectez à vos enseignants et suivez leur
              progression, dans le respect de leur vie privée.
            </p>
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, title: "Inviter", text: "Par e-mail ou avec un code d’inscription, avec date d’expiration et limite d’utilisation." },
              { icon: CheckCircle2, title: "Affecter", text: "Choisissez les formations adaptées à chaque enseignant, avec une échéance si besoin." },
              { icon: BarChart3, title: "Suivre", text: "Leçons, résultats aux évaluations et certificats, enseignant par enseignant." },
              { icon: FileText, title: "Rendre compte", text: "Téléchargez des rapports individuels de progression en PDF." },
            ].map((f) => (
              <li key={f.title} className="rounded-xl border border-line bg-surface p-6">
                <span className="flex size-11 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-section font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-1.5 text-body leading-relaxed text-ink-600">{f.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-body text-ink-600">
            Un établissement ne voit la progression d’un enseignant que pour les formations qu’il lui a affectées, et seulement après
            l’accord de l’enseignant. Ses formations personnelles restent privées.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demande-acces?profil=etablissement" className={buttonClasses({ variant: "accent", size: "lg" })}>
              Devenir partenaire
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Contact ──────────────────────────────────────────────────────── */}
      <section id="contact" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-2xl bg-brand-800 p-8 text-white sm:p-10 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <h2 className="text-[1.625rem] font-bold leading-tight">Contacter la Fondation</h2>
            <p className="mt-2 text-reading text-brand-200">
              Pour toute question sur la Fondation et ses programmes{supportEmail ? ", ou sur l’utilisation de la plateforme" : ""}.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-body">
              {FOUNDATION.social.map((s) => (
                <li key={s.href}>
                  <a href={s.href} className="text-brand-100 underline-offset-4 hover:text-white hover:underline" {...external}>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <a href={`mailto:${FOUNDATION.email}`} className={buttonClasses({ size: "lg", className: "bg-white! text-ink-900! hover:bg-ink-50!" })}>
              <Mail aria-hidden /> {FOUNDATION.email}
            </a>
            {supportEmail && supportEmail !== FOUNDATION.email ? (
              <a href={`mailto:${supportEmail}`} className={buttonClasses({ size: "lg", className: "border border-white/40 bg-transparent! text-white hover:bg-white/10!" })}>
                Assistance plateforme : {supportEmail}
              </a>
            ) : null}
            <Link href="/ressources" className="text-center text-label font-medium text-brand-100 underline-offset-4 hover:text-white hover:underline">
              Publications et ressources de la Fondation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
