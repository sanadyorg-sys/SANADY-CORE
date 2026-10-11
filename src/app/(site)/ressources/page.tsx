import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  PackageCheck,
  Sparkles,
} from "lucide-react";
import { BrandDots, SmileUnderline } from "@/components/brand/brand-decor";
import { buttonClasses } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";
import classroomPhoto2 from "../../../../public/brand/sanady-student-classroom-2.jpg";

export const metadata: Metadata = {
  title: "Bibliothèque Pédagogique & Mallette SANADY",
  description:
    "Consultez les ressources didactiques de la Fondation Sanady, la Mallette Pédagogique de référence, les rapports annuels et publications institutionnelles.",
};

interface ResourceItem {
  id: string;
  category: "mallette" | "rapport" | "partenariat" | "guide";
  categoryLabel: string;
  title: string;
  description: string;
  target: string;
  type: string;
  year?: string;
  downloadUrl?: string;
  officialRef?: boolean;
}

const RESOURCES: ResourceItem[] = [
  {
    id: "mallette-didactique",
    category: "mallette",
    categoryLabel: "Mallette Pédagogique",
    title: "Mallette Pédagogique SANADY — Outils Didactiques de Référence",
    description:
      "Boîte à outils pédagogiques et didactiques conçue par une équipe pluridisciplinaire de la Fondation : ressources, outils et supports pour le primaire (français, mathématiques) et le collège (français, mathématiques, physique-chimie). En libre accès sur sanady.org.",
    target: "Enseignants du primaire et collège",
    type: "Ensemble didactique / PDF",
    officialRef: true,
  },
  {
    id: "rapport-2017-2018",
    category: "rapport",
    categoryLabel: "Rapport Officiel",
    title: "Rapport Annuel d'Activité 2017-2018 — Fondation Sanady",
    description:
      "Bilan moral, réalisations sur le terrain, statistiques des centres de soutien et états financiers de la Fondation Sanady.",
    target: "Institutionnel",
    type: "Rapport annuel / PDF",
    year: "2018",
    downloadUrl: "https://sanady.org/pdf/19-00995-RappAnn_2017-2018_.pdf",
    officialRef: true,
  },
  {
    id: "rapport-2016-2017",
    category: "rapport",
    categoryLabel: "Rapport Officiel",
    title: "Rapport Annuel d'Activité 2016-2017 — Fondation Sanady",
    description:
      "Synthèse des actions d'accompagnement scolaire, déploiement des formations et partenariats éducatifs.",
    target: "Institutionnel",
    type: "Rapport annuel / PDF",
    year: "2017",
    downloadUrl: "https://sanady.org/pdf/Rapport%20annuel%202016%202017%20.pdf",
    officialRef: true,
  },
  {
    id: "brochure-institutionnelle",
    category: "rapport",
    categoryLabel: "Brochure Institutionnelle",
    title: "Brochure Institutionnelle de Présentation Sanady",
    description:
      "Présentation de l'histoire, des organes de gouvernance, des valeurs et des trois pôles d'action de la Fondation Sanady.",
    target: "Partenaires & Établissements",
    type: "Brochure officielle / PDF",
    downloadUrl: "https://sanady.org/pdf/Brochure-institutionnelle1.pdf",
    officialRef: true,
  },
  {
    id: "fiche-formation-enseignants",
    category: "partenariat",
    categoryLabel: "Fiche Partenariat",
    title: "Fiche n° 3 : Soutenir la formation continue des enseignants",
    description:
      "Modalités d'accompagnement des maîtres d'écoles publiques et financement de sessions de perfectionnement pédagogique.",
    target: "Entreprises citoyennes & Bailleurs",
    type: "Fiche descriptive / PDF",
    downloadUrl: "https://sanady.org/wp-content/uploads/2018/11/FICHE-3-formation.pdf",
    officialRef: true,
  },
  {
    id: "fiche-soutien-scolaire",
    category: "partenariat",
    categoryLabel: "Fiche Partenariat",
    title: "Fiche n° 2 : Soutien scolaire en zone prioritaire",
    description:
      "Mise en place de classes de soutien scolaire gratuit pour les élèves des zones rurales et péri-urbaines défavorisées.",
    target: "Partenaires publics & privés",
    type: "Fiche descriptive / PDF",
    downloadUrl: "https://sanady.org/wp-content/uploads/2018/11/FICHE-2-soutien-scolaire-2.pdf",
    officialRef: true,
  },
  {
    id: "fiche-orientation",
    category: "partenariat",
    categoryLabel: "Fiche Partenariat",
    title: "Fiche n° 4 : Financement du programme d'orientation",
    description:
      "Dispositif d'ateliers d'aide au choix d'orientation et à l'accès aux bourses d'études supérieures.",
    target: "Partenaires académiques",
    type: "Fiche descriptive / PDF",
    downloadUrl: "https://sanady.org/wp-content/uploads/2018/11/FICHE-4-orientation.pdf",
    officialRef: true,
  },
];

export default function ResourcesPage() {
  return (
    <>
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <Image
          src={classroomPhoto2}
          alt="Élève attentive dans une classe lumineuse"
          fill
          priority
          placeholder="blur"
          className="-z-10 object-cover opacity-20"
          sizes="100vw"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(15_23_42/0.85)_0%,rgb(15_23_42/0.95)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-light opacity-15" />

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-500/40 bg-accent-500/10 px-3.5 py-1 text-label font-semibold text-accent-400">
            <PackageCheck className="size-4" aria-hidden /> Outils didactiques & Publications
          </p>
          <h1 className="mt-5 max-w-3xl text-[2.25rem] font-extrabold leading-tight tracking-tight sm:text-[3rem]">
            Bibliothèque Pédagogique et Ressources{" "}
            <SmileUnderline className="text-accent-400">Officielles</SmileUnderline>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.125rem] leading-relaxed text-brand-200">
            Accédez aux documents de référence de la Fondation Sanady : la Mallette Pédagogique d’outils didactiques, les rapports
            annuels et les fiches méthodologiques.
          </p>
        </div>
      </section>

      {/* ─── Focus Mallette Pédagogique ───────────────────────────────────── */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Reveal className="grid items-center gap-10 rounded-3xl border-2 border-accent-500/30 bg-gradient-to-br from-accent-50/50 via-surface to-accent-50/20 p-8 shadow-xs lg:grid-cols-[1.4fr_1fr] lg:p-12">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-700 px-3.5 py-1 text-label font-bold text-white shadow-xs">
                <Sparkles className="size-3.5" aria-hidden /> Outil de Référence National
              </span>
              <h2 className="mt-4 text-[2rem] font-extrabold tracking-tight text-ink-900">La Mallette Pédagogique SANADY</h2>
              <p className="mt-3 text-reading leading-relaxed text-ink-700">
                Fruit de plus de 15 années d’expérience de terrain aux côtés des instituteurs marocains, la Mallette Pédagogique
                constitue le cœur méthodologique de la Fondation Sanady.
              </p>
              <ul className="mt-6 space-y-2.5 text-body text-ink-800">
                {[
                  "Fiches de remédiation ciblée pour le français, les mathématiques et l'éveil",
                  "Grilles d'évaluation diagnostique pour mesurer les acquis initiaux des élèves",
                  "Séquences didactiques structurées pas-à-pas pour l'enseignant",
                  "Supports d'activités ludiques et participatives favorisant la pédagogie active",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/formations" className={buttonClasses({ variant: "accent", size: "lg", className: "rounded-xl shadow-xs" })}>
                  <BookMarked className="size-4" aria-hidden /> Formations associées à la Mallette
                </Link>
                <a
                  href="https://sanady.org/mallette-pedagogique/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses({ variant: "secondary", size: "lg", className: "rounded-xl" })}
                >
                  Consulter sur sanady.org <ExternalLink className="size-4" aria-hidden />
                </a>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-accent-200 bg-surface/90 p-8 text-center shadow-md backdrop-blur-sm">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-accent-100 text-accent-700 shadow-xs">
                <PackageCheck className="size-8" aria-hidden />
              </span>
              <h3 className="mt-4 text-section font-bold text-ink-900">Mallette Didactique Complète</h3>
              <p className="mt-2 text-caption text-ink-600">
                Disponible pour les enseignants inscrits aux programmes de formation et les établissements partenaires.
              </p>
              <div className="mt-6 w-full rounded-xl bg-ink-50 p-4 text-left">
                <p className="text-caption font-bold uppercase tracking-wider text-ink-500">Composantes :</p>
                <p className="mt-1 text-label text-ink-800">
                  • Français : CP au CM2<br />
                  • Mathématiques & Logique<br />
                  • Grilles de suivi individuel
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Catalogue des publications ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
            <BrandDots /> Documentation officielle
          </p>
          <h2 className="mt-2 text-[1.875rem] font-extrabold tracking-tight text-ink-900">Rapports et publications à télécharger</h2>
          <p className="mt-2 text-reading text-ink-600">
            Tous les documents officiels publiés par la Fondation Sanady pour la transparence et la valorisation de ses actions.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((res, i) => (
            <Reveal
              as="div"
              key={res.id}
              delay={i * 60}
              className="card-shine flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-accent-500/40 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-caption font-semibold text-ink-700">
                    {res.categoryLabel}
                  </span>
                  {res.year && (
                    <span className="flex items-center gap-1 text-caption text-ink-500">
                      <Calendar className="size-3" aria-hidden /> {res.year}
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-card font-bold text-ink-900">{res.title}</h3>
                <p className="mt-2 text-body leading-relaxed text-ink-600">{res.description}</p>
              </div>

              <div className="mt-6 border-t border-line pt-4">
                <p className="text-caption text-ink-500">Public : <span className="font-medium text-ink-800">{res.target}</span></p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-caption text-ink-400">{res.type}</span>
                  {res.downloadUrl ? (
                    <a
                      href={res.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-label font-semibold text-accent-700 hover:text-accent-800 hover:underline"
                    >
                      <Download className="size-4" aria-hidden /> Télécharger
                    </a>
                  ) : (
                    <Link
                      href="/formations"
                      className="inline-flex items-center gap-1.5 text-label font-semibold text-accent-700 hover:text-accent-800 hover:underline"
                    >
                      Explorer <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
