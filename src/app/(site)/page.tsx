import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Laptop,
  Mail,
  MonitorSmartphone,
  Play,
  PlayCircle,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BrandDots, SmileUnderline } from "@/components/brand/brand-decor";
import { CatalogCard } from "@/components/site/catalog-card";
import { LearningPathsSection } from "@/components/site/learning-paths";
import { PartnerTrustBanner } from "@/components/site/partner-trust-banner";
import { SkillDiagnosticPreview } from "@/components/site/skill-diagnostic-preview";
import { TestimonialsSection } from "@/components/site/testimonials-section";

/**
 * Hidden until confirmed (decision of 11/10/2026, see docs/institution/reference-sanady.md):
 * - partners: written confirmation from the Foundation and right to use the official logos
 *   (logo files to add under public/brand/partners/);
 * - testimonials: real quotes from pilot teachers, with their consent (replace the examples).
 */
const SHOW_PARTNERS = false;
const SHOW_TESTIMONIALS = false;
import { VideoSpotlight } from "@/components/site/video-spotlight";
import { buttonClasses } from "@/components/ui/button";
import { CountUp, Reveal } from "@/components/ui/motion";
import { getViewer } from "@/server/auth";
import { getCatalog } from "@/server/queries/public";
import classroom from "../../../public/brand/sanady-student-classroom-1.jpg";
import profPhoto from "../../../public/brand/sanady-teacher.jpg";

export const metadata: Metadata = {
  title: { absolute: "SANADY — Formation et développement professionnel des enseignants" },
  description:
    "Formations gratuites pour les enseignants, proposées par la Fondation Sanady : vidéos, documents, évaluations par module et certificat vérifiable.",
};

const CATEGORY_ICONS: LucideIcon[] = [GraduationCap, Users, Laptop, BookOpen, BarChart3, ClipboardCheck];

const STEPS = [
  { icon: Mail, title: "Recevez une invitation", text: "De la Fondation Sanady ou de votre établissement — ou demandez un accès en ligne." },
  { icon: PlayCircle, title: "Apprenez à votre rythme", text: "Vidéos et documents courts, sur ordinateur, tablette ou téléphone. Reprenez là où vous vous êtes arrêté." },
  { icon: ClipboardCheck, title: "Validez chaque module", text: "Une évaluation à la fin de chaque module : 70 % de réussite, trois tentatives." },
  { icon: Award, title: "Obtenez votre certificat", text: "Délivré automatiquement à la fin de la formation, vérifiable en ligne par QR code." },
];

const FEATURES = [
  { icon: PlayCircle, title: "Vidéos et documents", text: "Des contenus courts et concrets, pensés pour la pratique en classe." },
  { icon: MonitorSmartphone, title: "Sur tous vos appareils", text: "Votre progression est enregistrée et vous suit d’un appareil à l’autre." },
  { icon: ClipboardCheck, title: "Évaluations formatives", text: "Des questions corrigées et expliquées pour ancrer vos acquis." },
  { icon: QrCode, title: "Certificat vérifiable", text: "Chaque certificat porte un numéro et un QR code, vérifiables par tous." },
  { icon: ShieldCheck, title: "Données protégées", text: "Vos formations personnelles restent privées. Vous gardez la main sur vos données." },
  { icon: Award, title: "Entièrement gratuit", text: "Une initiative de la Fondation Sanady au service des enseignants du Maroc." },
];

export default async function HomePage() {
  const [catalog, viewer] = await Promise.all([getCatalog(), getViewer()]);
  const featured = catalog.courses.slice(0, 6);
  const hours = Math.round(catalog.stats.minutes / 60);
  const stats = [
    { value: catalog.stats.courses, label: catalog.stats.courses > 1 ? "formations disponibles" : "formation disponible" },
    { value: hours, label: hours > 1 ? "heures de formation" : "heure de formation" },
    { value: catalog.stats.certificates, label: catalog.stats.certificates > 1 ? "certificats délivrés" : "certificat délivré" },
    { value: catalog.stats.institutions, label: catalog.stats.institutions > 1 ? "établissements partenaires" : "établissement partenaire" },
  ].filter((s) => s.value > 0);

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,var(--color-accent-50)_0%,var(--color-surface)_100%)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-35" />
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[34rem] rounded-full bg-accent-500/[0.08] blur-3xl animate-blob" />
        <div aria-hidden className="pointer-events-none absolute -left-32 bottom-0 size-[28rem] rounded-full bg-accent-400/[0.05] blur-2xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2.5 rounded-full border border-accent-500/25 bg-surface/85 px-3.5 py-1 text-label font-medium text-accent-800 shadow-xs backdrop-blur-sm">
              <span className="live-radar mr-0.5" />
              <BrandDots />
              <span>Fondation Sanady · Formation continue des enseignants</span>
            </p>
            <h1 className="mt-5 text-[2.375rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-900 sm:text-[3rem] lg:text-[3.5rem]">
              Développez vos pratiques,{" "}
              <SmileUnderline className="text-accent-700">
                faites grandir
              </SmileUnderline>{" "}
              vos élèves.
            </h1>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-ink-600 sm:text-[1.125rem]">
              Des formations gratuites, conçues pour les enseignants, à suivre à votre rythme : vidéos, documents, évaluations
              et certificat délivré par la Fondation Sanady.
            </p>

            <form action="/formations" role="search" className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Que souhaitez-vous apprendre ?</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-400" aria-hidden />
                <input
                  type="search"
                  name="q"
                  placeholder="Que souhaitez-vous apprendre ?"
                  className="h-12 w-full rounded-xl border border-line-strong bg-surface pl-12 pr-4 text-[1rem] text-ink-900 shadow-xs placeholder:text-ink-500 transition-all focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
                />
              </label>
              <button type="submit" className={buttonClasses({ variant: "brand", size: "xl", className: "btn-sheen rounded-xl shadow-xs" })}>
                Rechercher
              </button>
            </form>

            {catalog.categories.length ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-label text-ink-500">Thèmes populaires :</span>
                {catalog.categories.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    href={`/formations?theme=${c.id}`}
                    className="rounded-full border border-line-strong/80 bg-surface/80 px-3 py-1 text-label font-medium text-ink-700 backdrop-blur-xs transition-all hover:border-accent-600 hover:text-accent-700 hover:shadow-xs"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#video-fondation"
                className="group btn-sheen inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-surface/90 px-4 py-2 text-label font-bold text-accent-800 shadow-xs backdrop-blur-sm transition-all hover:border-accent-600 hover:bg-surface hover:text-accent-900 hover:shadow-md"
              >
                <span className="relative flex size-6 items-center justify-center rounded-full bg-accent-600 text-white transition group-hover:scale-110">
                  <Play className="size-3 fill-white translate-x-0.2" aria-hidden />
                </span>
                <span>Voir le film officiel (3 min)</span>
              </a>
              <span className="text-caption text-ink-500">· Découvrez la Fondation en action</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-black/10">
              <Image src={classroom} alt="Une élève souriante dans sa classe" fill priority placeholder="blur" className="object-cover" sizes="(min-width: 1024px) 560px, 100vw" />
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
            <div className="animate-float absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3.5 shadow-xl backdrop-blur-sm sm:-left-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-success-50 text-success-700 shadow-xs pulse-glow">
                <Award className="size-5" aria-hidden />
              </span>
              <div>
                <span className="block text-label font-bold text-ink-900">Certificat vérifiable</span>
                <span className="block text-caption text-ink-500">par QR code officiel</span>
              </div>
            </div>
            <div className="animate-float-slow absolute -top-6 right-4 hidden w-64 rounded-2xl border border-line bg-surface/95 p-3.5 shadow-xl backdrop-blur-sm sm:block lg:-right-6">
              <a href="#video-fondation" className="group flex items-center gap-3">
                <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-600 text-white shadow-xs transition group-hover:scale-110 group-hover:bg-accent-700">
                  <span className="absolute inset-0 animate-ping rounded-xl bg-accent-500/30 opacity-75" />
                  <Play className="size-4 fill-white translate-x-0.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-caption font-bold text-ink-900 transition group-hover:text-accent-700">Film officiel SANADY</span>
                  <span className="block text-[0.6875rem] text-accent-700">Regarder le reportage (3 min)</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Figures ──────────────────────────────────────────────────────── */}
      {stats.length ? (
        <Reveal as="section" aria-label="Chiffres clés" className="relative border-y border-line bg-surface">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-20" />
          <dl className="relative mx-auto grid max-w-7xl grid-cols-2 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-line">
            {stats.map((s) => (
              <div key={s.label} className="px-4 py-8 text-center sm:px-6">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block text-[2.25rem] font-extrabold tabular tracking-tight text-ink-900 sm:text-[2.75rem]">
                    <CountUp value={s.value} />
                  </span>
                  <span className="mt-1 block text-body font-medium text-ink-600">{s.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      ) : null}

      {/* ─── Institutional Trust & Partners (Edraak style) ────────────────── */}
      {SHOW_PARTNERS ? <PartnerTrustBanner /> : null}

      {/* ─── Featured courses ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <BrandDots /> Catalogue
            </p>
            <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Formations à la une</h2>
            <p className="mt-2 max-w-2xl text-reading text-ink-600">Des parcours courts et concrets, directement utiles dans votre classe.</p>
          </div>
          <Link href="/formations" className={buttonClasses({ variant: "secondary", size: "lg", className: "rounded-xl" })}>
            Voir tout le catalogue <ArrowRight aria-hidden />
          </Link>
        </Reveal>
        {featured.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c, i) => (
              <Reveal key={c.id} delay={i * 80}>
                <CatalogCard course={c} />
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="mt-10 rounded-2xl border border-dashed border-line-strong bg-ink-25 p-10 text-center text-body text-ink-600">
            Les premières formations seront bientôt présentées ici.
          </p>
        )}
      </section>

      {/* ─── Structured Learning Paths (Edraak & Pluralsight inspired) ─────── */}
      <LearningPathsSection />

      {/* ─── Diagnostic Pedagogical Preview (Pluralsight Skill IQ inspired) ── */}
      <SkillDiagnosticPreview />

      {/* ─── Themes ───────────────────────────────────────────────────────── */}
      {catalog.categories.length ? (
        <section className="relative overflow-hidden bg-ink-25 py-16 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-25" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
                <BrandDots /> Domaines d’apprentissage
              </p>
              <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">Explorer par thème</h2>
              <p className="mt-2 max-w-2xl text-reading text-ink-600">
                Découvrez des formations ciblées selon vos priorités et vos projets pédagogiques.
              </p>
            </Reveal>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.categories.map((c, i) => {
                const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length]!;
                return (
                  <Reveal as="li" key={c.id} delay={i * 60}>
                    <Link
                      href={`/formations?theme=${c.id}`}
                      className="group card-shine flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-accent-500/40 hover:shadow-md"
                    >
                      <span className="flex size-13 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700 transition-all duration-300 group-hover:scale-105 group-hover:bg-accent-500 group-hover:text-white group-hover:shadow-md">
                        <Icon className="size-6" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-card font-bold text-ink-900 transition-colors group-hover:text-accent-800">{c.name}</span>
                        <span className="mt-0.5 block text-label text-ink-500">
                          {c.count} {c.count > 1 ? "formations" : "formation"}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-ink-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent-700" aria-hidden />
                    </Link>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Parcours
          </p>
          <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">
            De l’invitation au certificat, en quatre étapes
          </h2>
          <p className="mt-2 text-reading text-ink-600">
            Une expérience fluide, conçue pour s’adapter aux contraintes de temps des enseignants.
          </p>
        </Reveal>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 80} className="group card-shine relative flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-accent-500/40 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-xl bg-brand-700 text-white shadow-xs transition-colors group-hover:bg-accent-600">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <span className="text-[2.25rem] font-extrabold tabular leading-none text-ink-200 transition-colors group-hover:text-accent-400" aria-hidden>
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-5 text-section font-bold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-body leading-relaxed text-ink-600">{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ─── Teacher Testimonials & Classroom Stories (Edraak style) ─────── */}
      {SHOW_TESTIMONIALS ? <TestimonialsSection /> : null}

      {/* ─── Official Fondation SANADY Video Spotlight ─────────────────────── */}
      <VideoSpotlight id="video-fondation" initialTime={51} />

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-brand-800 py-16 text-white sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-light opacity-15" />
        <div aria-hidden className="pointer-events-none absolute -right-20 top-1/4 size-[32rem] rounded-full bg-accent-600/10 blur-3xl animate-aurora" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.35fr] lg:gap-16 lg:px-8">
          <div>
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-400">
              <BrandDots /> Pourquoi SANADY
            </p>
            <h2 className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight sm:text-[2.25rem]">
              Un environnement pensé pour les enseignants
            </h2>
            <p className="mt-4 text-reading leading-relaxed text-brand-200">
              Une plateforme simple, sérieuse et respectueuse, qui valorise votre engagement dans votre développement professionnel.
            </p>
            <div className="relative mt-8 hidden aspect-[4/3] max-w-md overflow-hidden rounded-3xl border border-white/15 shadow-2xl lg:block">
              <Image
                src={profPhoto}
                alt="Session de formation des enseignants de la Fondation Sanady"
                fill
                unoptimized
                className="object-cover object-center"
              />
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-900/80 via-transparent to-transparent" />
              <div className="absolute bottom-3.5 inset-x-3.5 flex items-center justify-between rounded-xl bg-brand-900/85 px-3.5 py-2 text-caption text-brand-100 backdrop-blur-md border border-white/10">
                <span className="font-semibold text-white">Formation continue des enseignants</span>
                <span className="text-accent-400 font-bold">Fondation Sanady</span>
              </div>
            </div>
          </div>
          <ul className="grid content-start gap-5 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal as="li" key={f.title} delay={i * 60} className="glow-card rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xs transition duration-300 hover:border-accent-500/40 hover:bg-white/[0.08]">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-accent-400 shadow-xs">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-section font-bold text-white">{f.title}</h3>
                <p className="mt-1.5 text-body leading-relaxed text-brand-200">{f.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Institutions ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="grid items-center gap-10 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-ink-25 via-surface to-accent-50/20 p-8 shadow-xs sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:p-14">
          <div>
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <Building2 className="size-4" aria-hidden /> Établissements scolaires
            </p>
            <h2 className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900">
              Accompagnez la formation de vos équipes
            </h2>
            <p className="mt-3 text-reading leading-relaxed text-ink-600">
              La Fondation Sanady ouvre un espace dédié à chaque établissement partenaire : pilotez les parcours et suivez la montée en compétences.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demande-acces?profil=etablissement" className={buttonClasses({ variant: "accent", size: "lg", className: "rounded-xl" })}>
                Devenir partenaire
              </Link>
              <Link href="/a-propos#etablissements" className={buttonClasses({ variant: "secondary", size: "lg", className: "rounded-xl" })}>
                En savoir plus
              </Link>
            </div>
          </div>
          <ul className="space-y-3">
            {[
              "Invitez vos enseignants par e-mail ou avec un code d'établissement",
              "Affectez les formations adaptées à vos objectifs annuels",
              "Suivez la progression et les résultats de chaque enseignant",
              "Téléchargez des bilans et attestations individuelles en PDF",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 rounded-xl border border-line/80 bg-surface/90 p-4 text-body font-medium text-ink-800 shadow-xs backdrop-blur-xs">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ─── Call to action ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-r from-accent-700 via-accent-600 to-accent-800 py-14 text-white sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-light opacity-15" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-caption font-semibold text-white backdrop-blur-sm">
              <Sparkles className="size-3.5" aria-hidden /> Fondation Sanady
            </span>
            <h2 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight sm:text-[2.25rem]">
              Prêt à développer vos pratiques ?
            </h2>
            <p className="mt-2 text-[1.0625rem] font-medium text-accent-100">
              {viewer ? "Retrouvez vos formations là où vous les avez laissées." : "Rejoignez la communauté des enseignants SANADY au Maroc."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3.5">
            {viewer ? (
              <Link href="/mon-espace" className={buttonClasses({ size: "xl", className: "rounded-xl bg-white! font-bold text-ink-900! shadow-lg hover:bg-ink-50!" })}>
                Accéder à mon espace <ArrowRight aria-hidden />
              </Link>
            ) : (
              <>
                <Link href="/demande-acces" className={buttonClasses({ size: "xl", className: "rounded-xl bg-white! font-bold text-ink-900! shadow-lg hover:bg-ink-50!" })}>
                  Demander un accès <ArrowRight aria-hidden />
                </Link>
                <Link
                  href="/connexion"
                  className={buttonClasses({ size: "xl", className: "rounded-xl border-2 border-white/80 bg-white/10! font-bold text-white backdrop-blur-xs hover:bg-white/20!" })}
                >
                  Se connecter
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
