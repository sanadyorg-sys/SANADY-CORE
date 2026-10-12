import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  BarChart3,
  CheckCircle2,
  FileText,
  HeartHandshake,
  Landmark,
  Lightbulb,
  Mail,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandDots, SmileUnderline } from "@/components/brand/brand-decor";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import { createClient } from "@/lib/supabase/server";
import { FOUNDATION } from "@/lib/institution";
import studentsPhoto from "../../../../public/brand/sanady-students-waving.jpg";

export const metadata: Metadata = {
  title: "À propos — Fondation SANADY",
  description:
    "SANADY, la plateforme de formation et de perfectionnement professionnel des enseignants de la Fondation Sanady.",
};

const VALUES = [
  { icon: Lightbulb, title: "Utile en classe", text: "Des contenus courts, concrets et directement applicables avec vos élèves au quotidien." },
  { icon: HeartHandshake, title: "Bienveillance", text: "L’erreur fait partie intégrante du processus d’apprentissage, pour les élèves comme pour les enseignants." },
  { icon: ShieldCheck, title: "Respect et éthique", text: "Vos formations personnelles restent privées ; chaque enseignant garde la maîtrise totale de ses données." },
  { icon: Sparkles, title: "Exigence institutionnelle", text: "Évaluations formatives à chaque module et certificat sécurisé vérifiable par QR code." },
];

export default async function AboutPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_platform_info");
  const supportEmail = (data as { support_email?: string | null } | null)?.support_email;

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_0%,rgb(224_78_0/0.18),transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-light opacity-15" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-8 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3.5 py-1 text-label font-semibold uppercase tracking-[0.18em] text-accent-400">
              <BrandDots /> Fondation Sanady
            </p>
            <h1 className="mt-5 max-w-3xl text-[2.5rem] font-extrabold leading-[1.08] tracking-tight sm:text-[3.25rem]">
              Préparons les adultes du{" "}
              <SmileUnderline className="text-accent-400">
                Maroc de demain
              </SmileUnderline>
              .
            </h1>
            <p className="mt-6 max-w-2xl text-[1.125rem] leading-relaxed text-brand-100">
              Association marocaine reconnue d’utilité publique, active depuis 2009. La Fondation Sanady œuvre contre l’abandon et l’échec
              scolaires des élèves des établissements publics issus des milieux socio-économiques défavorisés.
            </p>
          </div>
          {/* Source photo is 400 px wide: shown at (close to) natural size, never stretched. */}
          <figure className="relative mx-auto w-full max-w-[25rem] rotate-1 overflow-hidden rounded-3xl border-4 border-white/10 shadow-2xl">
            <Image
              src={studentsPhoto}
              alt="Élèves souriants qui saluent devant leur école"
              priority
              placeholder="blur"
              className="h-auto w-full"
              sizes="400px"
            />
          </figure>
        </div>
      </section>

      {/* ─── Mission & Vision ──────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
        <Reveal>
          <span className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Engagement historique
          </span>
          <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">
            Une mission dédiée à l’école publique et à ses maîtres
          </h2>
          <div className="mt-5 space-y-4 text-reading text-ink-700">
            <p>
              Fondée en 2009, la Fondation Sanady intervient dans les zones rurales et péri-urbaines à travers le Maroc pour
              garantir l’égalité des chances face à la scolarisation.
            </p>
            <p>
              Parce que la qualité de l’enseignement repose avant tout sur les compétences et l’épanouissement des professeurs,
              SANADY propose un accompagnement continu et des ressources didactiques de premier plan, en harmonie avec la
              <strong> Vision 2015-2030</strong> pour la réforme du système éducatif marocain.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/programmes" className={buttonClasses({ variant: "accent", size: "lg", className: "rounded-xl" })}>
                Découvrir nos 3 pôles d’action <ArrowRight aria-hidden />
              </Link>
              <Link href="/ressources" className={buttonClasses({ variant: "secondary", size: "lg", className: "rounded-xl" })}>
                <PackageCheck className="size-4" aria-hidden /> La Mallette Pédagogique
              </Link>
            </div>
          </div>
        </Reveal>
        <ul className="grid gap-5 sm:grid-cols-2">
          {VALUES.map((v, i) => (
            <Reveal as="li" key={v.title} delay={i * 70} className="card-shine rounded-2xl border border-line bg-surface p-6 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-accent-500/40 hover:shadow-md">
              <span className="flex size-12 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                <v.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-section font-bold text-ink-900">{v.title}</h3>
              <p className="mt-1.5 text-body leading-relaxed text-ink-600">{v.text}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ─── Mission & vision (official wording) ───────────────────────────── */}
      <section aria-labelledby="mission" className="border-y border-line bg-ink-25">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-2 lg:px-8">
          <h2 id="mission" className="sr-only">
            Mission et vision de la Fondation Sanady
          </h2>
          {[
            { label: "Notre mission", text: FOUNDATION.mission },
            { label: "Notre vision", text: FOUNDATION.vision },
          ].map((q, i) => (
            <Reveal as="figure" key={q.label} delay={i * 80} className="rounded-2xl border border-line bg-surface p-7 shadow-xs">
              <figcaption className="text-label font-bold uppercase tracking-wider text-accent-700">{q.label}</figcaption>
              <blockquote className="mt-3 border-l-4 border-accent-500 pl-4 text-reading leading-relaxed text-ink-800">« {q.text} »</blockquote>
            </Reveal>
          ))}
          <p className="text-label text-ink-500 md:col-span-2">
            Source :{" "}
            <a href={FOUNDATION.presentationUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-700 hover:underline">
              sanady.org — Présentation
            </a>
          </p>
        </div>
      </section>

      {/* ─── Film: shown once, on the home page (no repeated picture) ────────── */}
      <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <Link
          href="/#video-fondation"
          className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-ink-25 px-6 py-5 transition hover:border-accent-600/50 hover:bg-accent-50/40"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent-700 text-white">
              <Play className="size-4 translate-x-px fill-white" aria-hidden />
            </span>
            <span>
              <span className="block text-card font-bold text-ink-900">La Fondation Sanady en action</span>
              <span className="block text-label text-ink-600">Regarder le film de la Fondation (3 min)</span>
            </span>
          </span>
          <ArrowRight className="size-5 text-ink-400 transition-transform group-hover:translate-x-1 group-hover:text-accent-700" aria-hidden />
        </Link>
      </div>

      {/* ─── Pour les établissements scolaires ────────────────────────────── */}
      <section id="etablissements" className="relative scroll-mt-24 overflow-hidden bg-ink-25 py-16 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-20" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> Établissements partenaires
            </p>
            <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Un espace dédié à votre établissement</h2>
            <p className="mt-3 text-reading text-ink-600">
              La Fondation Sanady autorise des formations ciblées pour votre établissement. Vous les affectez à vos enseignants et suivez leur
              progression en toute confidentialité.
            </p>
          </Reveal>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, title: "Inviter", text: "Par e-mail ou avec un code d’inscription sécurisé, paramétrable avec date d’expiration." },
              { icon: CheckCircle2, title: "Affecter", text: "Sélectionnez les formations conformes aux besoins réels de vos enseignants." },
              { icon: BarChart3, title: "Suivre", text: "Indicateurs d'avancement, leçons validées et résultats aux évaluations de chaque module." },
              { icon: FileText, title: "Rapports", text: "Générez et téléchargez des rapports individuels de progression au format PDF." },
            ].map((f, i) => (
              <Reveal as="li" key={f.title} delay={i * 80} className="card-shine rounded-2xl border border-line bg-surface p-6 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-accent-500/40 hover:shadow-md">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-section font-bold text-ink-900">{f.title}</h3>
                <p className="mt-1.5 text-body leading-relaxed text-ink-600">{f.text}</p>
              </Reveal>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/demande-acces?profil=etablissement" className={buttonClasses({ variant: "accent", size: "lg", className: "rounded-xl" })}>
              Devenir établissement partenaire
            </Link>
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} className={buttonClasses({ variant: "secondary", size: "lg", className: "rounded-xl" })}>
                <Mail aria-hidden /> {supportEmail}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* ─── Governance & organisation (official wording) ─────────────────── */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8">
        <Reveal className="rounded-2xl border border-line p-7">
          <Landmark className="size-6 text-accent-700" aria-hidden />
          <h2 className="mt-3 text-section font-bold text-ink-900">Gouvernance</h2>
          <p className="mt-2 text-body leading-relaxed text-ink-600">{FOUNDATION.governance}</p>
        </Reveal>
        <Reveal delay={80} className="rounded-2xl border border-line p-7">
          <Users className="size-6 text-accent-700" aria-hidden />
          <h2 className="mt-3 text-section font-bold text-ink-900">Organisation</h2>
          <p className="mt-2 text-body leading-relaxed text-ink-600">{FOUNDATION.organisation}</p>
        </Reveal>
      </section>

      {/* ─── Contact ──────────────────────────────────────────────────────── */}
      <section id="contact" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-3xl bg-brand-800 p-8 text-white sm:p-10 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <h2 className="text-[1.625rem] font-bold leading-tight">Contacter la Fondation</h2>
            <p className="mt-2 text-reading text-brand-200">Pour toute question sur la Fondation et ses programmes.</p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-body">
              {FOUNDATION.social.map((sn) => (
                <li key={sn.href}>
                  <a href={sn.href} target="_blank" rel="noopener noreferrer" className="text-brand-100 underline-offset-4 hover:text-white hover:underline">
                    {sn.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <a href={`mailto:${FOUNDATION.email}`} className={buttonClasses({ size: "lg", className: "bg-white! text-ink-900! hover:bg-ink-50!" })}>
            <Mail aria-hidden /> {FOUNDATION.email}
          </a>
        </div>
      </section>
    </>
  );
}
