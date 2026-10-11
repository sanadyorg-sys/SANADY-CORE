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
  PlayCircle,
  QrCode,
  Search,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CatalogCard } from "@/components/site/catalog-card";
import { buttonClasses } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { getViewer } from "@/server/auth";
import { getCatalog } from "@/server/queries/public";
import classroom from "../../../public/brand/sanady-classroom.jpg";
import portrait from "../../../public/brand/sanady-classroom-portrait.jpg";

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
        <div aria-hidden className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-accent-500/[0.07]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-surface px-3 py-1 text-label font-medium text-accent-800">
              <span className="size-1.5 rounded-full bg-accent-500" aria-hidden /> Fondation Sanady · Formation des enseignants
            </p>
            <h1 className="mt-5 text-[2.375rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-900 sm:text-[3rem] lg:text-[3.5rem]">
              Développez vos pratiques, <span className="text-accent-600">faites grandir</span> vos élèves.
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
                  className="h-12 w-full rounded-lg border border-line-strong bg-surface pl-12 pr-4 text-[1rem] text-ink-900 shadow-xs placeholder:text-ink-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
                />
              </label>
              <button type="submit" className={buttonClasses({ variant: "brand", size: "xl" })}>
                Rechercher
              </button>
            </form>

            {catalog.categories.length ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-label text-ink-500">Thèmes :</span>
                {catalog.categories.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    href={`/formations?theme=${c.id}`}
                    className="rounded-full border border-line-strong bg-surface px-3 py-1 text-label font-medium text-ink-700 transition-colors hover:border-accent-600 hover:text-accent-700"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] shadow-xl ring-1 ring-black/5">
              <Image src={classroom} alt="Une élève souriante dans sa classe" fill priority placeholder="blur" className="object-cover" sizes="(min-width: 1024px) 560px, 100vw" />
            </div>
            <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg sm:-left-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-success-50 text-success-700">
                <Award className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-label font-semibold text-ink-900">Certificat vérifiable</span>
                <span className="block text-caption text-ink-500">par QR code</span>
              </span>
            </div>
            <div className="absolute -top-5 right-4 hidden w-56 rounded-xl border border-line bg-surface p-4 shadow-lg sm:block lg:-right-6">
              <p className="text-caption font-medium text-ink-500">Module 2 · en cours</p>
              <p className="mt-1 text-label font-semibold text-ink-900">Donner une rétroaction efficace</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full w-3/4 rounded-full bg-accent-500" />
              </div>
              <p className="mt-1.5 text-right text-caption tabular text-ink-600">75&nbsp;%</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Figures ──────────────────────────────────────────────────────── */}
      {stats.length ? (
        <section aria-label="Chiffres clés" className="border-y border-line bg-surface">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-y-6 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block text-[2rem] font-extrabold tabular tracking-tight text-ink-900">{formatNumber(s.value)}</span>
                  <span className="text-body text-ink-600">{s.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* ─── Featured courses ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-label font-semibold uppercase tracking-wider text-accent-700">Catalogue</p>
            <h2 className="mt-2 text-[1.875rem] font-bold leading-tight tracking-tight text-ink-900">Formations à la une</h2>
            <p className="mt-2 max-w-2xl text-reading text-ink-600">Des parcours courts et concrets, directement utiles dans votre classe.</p>
          </div>
          <Link href="/formations" className={buttonClasses({ variant: "secondary", size: "lg" })}>
            Voir tout le catalogue <ArrowRight aria-hidden />
          </Link>
        </div>
        {featured.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => (
              <CatalogCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <p className="mt-10 rounded-xl border border-dashed border-line-strong bg-ink-25 p-10 text-center text-body text-ink-600">
            Les premières formations seront bientôt présentées ici.
          </p>
        )}
      </section>

      {/* ─── Themes ───────────────────────────────────────────────────────── */}
      {catalog.categories.length ? (
        <section className="bg-ink-25">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <h2 className="text-[1.875rem] font-bold leading-tight tracking-tight text-ink-900">Explorer par thème</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.categories.map((c, i) => {
                const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length]!;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/formations?theme=${c.id}`}
                      className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-5 transition hover:border-accent-500/60 hover:shadow-md"
                    >
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700 transition-colors group-hover:bg-accent-500 group-hover:text-white">
                        <Icon className="size-6" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-card font-semibold text-ink-900">{c.name}</span>
                        <span className="text-label text-ink-500">
                          {c.count} {c.count > 1 ? "formations" : "formation"}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-accent-700" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-label font-semibold uppercase tracking-wider text-accent-700">Comment ça marche</p>
          <h2 className="mt-2 text-[1.875rem] font-bold leading-tight tracking-tight text-ink-900">De l’invitation au certificat, en quatre étapes</h2>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-line bg-surface p-6">
              <span className="absolute right-5 top-5 text-[2.5rem] font-extrabold leading-none text-ink-100" aria-hidden>
                {i + 1}
              </span>
              <span className="flex size-11 items-center justify-center rounded-lg bg-brand-700 text-white">
                <s.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-section font-semibold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-body leading-relaxed text-ink-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section className="bg-brand-800 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-label font-semibold uppercase tracking-wider text-accent-500">Pourquoi SANADY</p>
            <h2 className="mt-2 text-[1.875rem] font-bold leading-tight tracking-tight">Un environnement pensé pour les enseignants</h2>
            <p className="mt-4 text-reading text-brand-200">
              Une plateforme simple, sérieuse et respectueuse, qui valorise votre engagement dans votre développement professionnel.
            </p>
            <div className="relative mt-8 hidden aspect-[4/5] max-w-sm overflow-hidden rounded-2xl lg:block">
              <Image src={portrait} alt="" fill placeholder="blur" className="object-cover object-[50%_25%]" sizes="384px" />
            </div>
          </div>
          <ul className="grid content-start gap-x-8 gap-y-10 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="flex size-11 items-center justify-center rounded-lg bg-white/10 text-accent-500">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-section font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-body leading-relaxed text-brand-200">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Institutions ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid items-center gap-10 overflow-hidden rounded-2xl border border-line bg-ink-25 p-8 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:p-14">
          <div>
            <p className="inline-flex items-center gap-2 text-label font-semibold uppercase tracking-wider text-accent-700">
              <Building2 className="size-4" aria-hidden /> Établissements scolaires
            </p>
            <h2 className="mt-3 text-[1.75rem] font-bold leading-tight tracking-tight text-ink-900">Accompagnez la formation de vos équipes</h2>
            <p className="mt-3 text-reading text-ink-600">
              La Fondation Sanady ouvre un espace dédié à chaque établissement partenaire.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/demande-acces?profil=etablissement" className={buttonClasses({ variant: "accent", size: "lg" })}>
                Devenir partenaire
              </Link>
              <Link href="/a-propos#etablissements" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                En savoir plus
              </Link>
            </div>
          </div>
          <ul className="space-y-3">
            {[
              "Invitez vos enseignants par e-mail ou avec un code",
              "Affectez les formations adaptées à vos besoins",
              "Suivez la progression et les résultats de chacun",
              "Téléchargez des rapports individuels en PDF",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 rounded-lg bg-surface p-4 text-body text-ink-800 shadow-xs ring-1 ring-line">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Call to action ───────────────────────────────────────────────── */}
      <section className="bg-accent-700">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div className="text-white">
            <h2 className="text-[1.875rem] font-extrabold leading-tight tracking-tight">Prêt à commencer ?</h2>
            <p className="mt-2 text-[1.0625rem] font-medium text-white">
              {viewer ? "Retrouvez vos formations là où vous les avez laissées." : "Rejoignez la communauté des enseignants SANADY."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {viewer ? (
              <Link href="/mon-espace" className={buttonClasses({ size: "xl", className: "bg-white! text-ink-900! hover:bg-ink-50!" })}>
                Accéder à mon espace <ArrowRight aria-hidden />
              </Link>
            ) : (
              <>
                <Link href="/demande-acces" className={buttonClasses({ size: "xl", className: "bg-white! font-bold text-ink-900! hover:bg-ink-50!" })}>
                  Demander un accès <ArrowRight aria-hidden />
                </Link>
                <Link
                  href="/connexion"
                  className={buttonClasses({ size: "xl", className: "border-2 border-white bg-transparent! font-bold text-white hover:bg-white/10!" })}
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
