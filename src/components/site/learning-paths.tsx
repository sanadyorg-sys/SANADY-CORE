"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Layers,
  PlayCircle,
  QrCode,
  Sparkles,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

interface PathStep {
  step: number;
  title: string;
  duration: string;
  description: string;
  highlights: string[];
  formats: { type: "video" | "pdf" | "quiz"; label: string }[];
}

interface LearningPath {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  audience: string;
  totalDuration: string;
  moduleCount: number;
  certificateTitle: string;
  skills: string[];
  steps: PathStep[];
}

const LEARNING_PATHS: LearningPath[] = [
  {
    id: "fondamental",
    badge: "Parcours Enseignement & Climat",
    title: "Enseignement Fondamental & Gestion Bienveillante",
    subtitle: "Maîtriser les leviers d’une classe sereine, engagée et participative au quotidien.",
    audience: "Enseignants du Primaire et du Secondaire collégial",
    totalDuration: "5 h 15 min",
    moduleCount: 3,
    certificateTitle: "Certificat de Spécialisation en Climat & Gestion de Classe",
    skills: [
      "Instauration de règles explicites et positives",
      "Techniques de rétroaction formative continue",
      "Évaluation authentique sans stigmatisation",
      "Régulation de l'hétérogénéité et engagement actif",
    ],
    steps: [
      {
        step: 1,
        title: "Instaurer un climat scolaire propice aux apprentissages",
        duration: "1 h 30",
        description: "Construire un cadre sécurisant et encourageant où l'erreur est perçue comme une opportunité d'apprentissage.",
        highlights: ["Règles de vie co-construites", "Rituels de début et fin de séance", "Posture d'autorité bienveillante"],
        formats: [
          { type: "video", label: "3 capsules vidéo" },
          { type: "pdf", label: "Guide des rituels" },
          { type: "quiz", label: "Évaluation 70%" },
        ],
      },
      {
        step: 2,
        title: "Donner une rétroaction efficace et constructive",
        duration: "2 h 00",
        description: "Passer de la simple notation chiffrée à des commentaires opérationnels qui guident l'élève vers l'autonomie.",
        highlights: ["Les 4 types de rétroactions", "Co-analyse d'erreurs entre pairs", "Grilles d'auto-évaluation"],
        formats: [
          { type: "video", label: "4 vidéos concrètes" },
          { type: "pdf", label: "Fiche d'exemples commentés" },
          { type: "quiz", label: "Évaluation 70%" },
        ],
      },
      {
        step: 3,
        title: "Concevoir des évaluations formatives et diagnostiques",
        duration: "1 h 45",
        description: "Mesurer les acquis en cours de séquence pour ajuster immédiatement votre progression pédagogique.",
        highlights: ["Bilans de sortie de cours", "Quiz rapides en classe", "Remédiation immédiate"],
        formats: [
          { type: "video", label: "3 vidéos d'analyse" },
          { type: "pdf", label: "Modèles de grilles" },
          { type: "quiz", label: "Évaluation finale 70%" },
        ],
      },
    ],
  },
  {
    id: "remediation",
    badge: "Parcours Soutien & TaRL",
    title: "Remédiation Pédagogique & Niveau Réel (TaRL)",
    subtitle: "Diagnostiquer et combler les lacunes fondamentales en lecture, écriture et calcul.",
    audience: "Enseignants d'appui, animateurs de soutien et enseignants du cycle primaire",
    totalDuration: "6 h 00 min",
    moduleCount: 3,
    certificateTitle: "Certificat d'Expertise en Remédiation Didactique",
    skills: [
      "Diagnostic rapide des freins d'apprentissage",
      "Regroupement par niveau réel de compétences",
      "Activités ludiques de remédiation accélérée",
      "Mesure hebdomadaire de la progression",
    ],
    steps: [
      {
        step: 1,
        title: "Diagnostic rapide des compétences de base",
        duration: "2 h 00",
        description: "Évaluer individuellement chaque élève sur les fondamentaux en quelques minutes avec des outils standardisés.",
        highlights: ["Passation des grilles diagnostiques", "Identification des seuils critiques", "Cartographie de la classe"],
        formats: [
          { type: "video", label: "4 vidéos de démonstration" },
          { type: "pdf", label: "Fiches de test" },
          { type: "quiz", label: "Évaluation 70%" },
        ],
      },
      {
        step: 2,
        title: "Activités ciblées et ateliers par niveau réel",
        duration: "2 h 30",
        description: "Mettre en œuvre des jeux et exercices courts qui ciblent spécifiquement le palier d'apprentissage manquant.",
        highlights: ["Jeux phonologiques et syllabiques", "Sens des 4 opérations arithmétiques", "Manipulation d'objets et cartes"],
        formats: [
          { type: "video", label: "5 vidéos d'ateliers réels" },
          { type: "pdf", label: "Livret de 30 activités" },
          { type: "quiz", label: "Évaluation 70%" },
        ],
      },
      {
        step: 3,
        title: "Suivi des progrès et réintégration dans le cursus",
        duration: "1 h 30",
        description: "Mesurer l'impact des séances de remédiation et consolider la réintégration réussie dans le groupe classe.",
        highlights: ["Tableau de bord de suivi", "Mesure du gain d'apprentissage", "Valorisation de l'effort"],
        formats: [
          { type: "video", label: "2 vidéos de synthèse" },
          { type: "pdf", label: "Fiche bilan imprimable" },
          { type: "quiz", label: "Évaluation finale 70%" },
        ],
      },
    ],
  },
  {
    id: "numerique",
    badge: "Parcours Numérique & TICE",
    title: "Numérique Éducatif au Service de la Pédagogie",
    subtitle: "Utiliser les outils numériques simples pour diversifier les approches et captiver les élèves.",
    audience: "Tous cycles · Aucun prérequis technique complexe",
    totalDuration: "5 h 00 min",
    moduleCount: 3,
    certificateTitle: "Certificat de Compétences Numériques Éducatives",
    skills: [
      "Sélection de ressources libres et fiables",
      "Création de supports visuels et interactifs",
      "Animation de séances hybrides dynamiques",
      "Sensibilisation des élèves à la citoyenneté numérique",
    ],
    steps: [
      {
        step: 1,
        title: "Intégrer les ressources multimédias sans surcharge",
        duration: "1 h 30",
        description: "Choisir des vidéos courtes, schémas et animations qui clarifient les notions abstraites sans distraire.",
        highlights: ["Critères de choix d'une ressource", "Banques de ressources éducatives libres", "Gestion du temps d'écran"],
        formats: [
          { type: "video", label: "3 tutoriels guidés" },
          { type: "pdf", label: "Guide de sélection" },
          { type: "quiz", label: "Évaluation 70%" },
        ],
      },
      {
        step: 2,
        title: "Concevoir des supports interactifs stimulants",
        duration: "2 h 00",
        description: "Élaborer facilement des fiches numériques, schémas animés et exercices autocorrectifs.",
        highlights: ["Outils gratuits et ergonomiques", "Conception visuelle accessible", "Formats mobiles pour les élèves"],
        formats: [
          { type: "video", label: "4 ateliers pratiques" },
          { type: "pdf", label: "Modèles téléchargeables" },
          { type: "quiz", label: "Évaluation 70%" },
        ],
      },
      {
        step: 3,
        title: "Évaluer et dynamiser avec le numérique en classe",
        duration: "1 h 30",
        description: "Utiliser des sondages rapides et quiz interactifs pour vérifier la compréhension de tous en direct.",
        highlights: ["Sondages instantanés", "Feedback collectif anonymisé", "Engagement des élèves réservés"],
        formats: [
          { type: "video", label: "3 vidéos d'usages en classe" },
          { type: "pdf", label: "Fiche méthodologique" },
          { type: "quiz", label: "Évaluation finale 70%" },
        ],
      },
    ],
  },
  {
    id: "inclusion",
    badge: "Parcours Inclusion & Diversité",
    title: "Différenciation & Inclusion des Élèves à Besoins Particuliers",
    subtitle: "Adapter votre enseignement pour que chaque élève, quelles que soient ses difficultés, progresse.",
    audience: "Enseignants du Primaire et Secondaire · Équipes de soutien",
    totalDuration: "5 h 15 min",
    moduleCount: 3,
    certificateTitle: "Certificat d'Inclusion Scolaire & Différenciation",
    skills: [
      "Repérage précoce des troubles spécifiques (Dys)",
      "Adaptation ergonomique des consignes et documents",
      "Stratégies de co-apprentissage en classe",
      "Coopération constructive avec les familles",
    ],
    steps: [
      {
        step: 1,
        title: "Identifier les freins d'apprentissage courants (Dyslexie, Dyscalculie)",
        duration: "2 h 00",
        description: "Comprendre les mécanismes cognitifs pour ne plus confondre difficulté passagère et trouble spécifique.",
        highlights: ["Grilles d'observation bienveillantes", "Mythes et réalités sur les troubles Dys", "Éviter la stigmatisation"],
        formats: [
          { type: "video", label: "4 capsules d'experts" },
          { type: "pdf", label: "Mémento des signes d'alerte" },
          { type: "quiz", label: "Évaluation 70%" },
        ],
      },
      {
        step: 2,
        title: "Adapter les consignes, les supports et le temps",
        duration: "1 h 45",
        description: "Des ajustements simples mais décisifs : typographie, aération, guidage par étapes, temps modulé.",
        highlights: ["Polices et contrastes adaptés", "Consignes découpées en micro-tâches", "Utilisation d'aides visuelles"],
        formats: [
          { type: "video", label: "3 démonstrations d'adaptation" },
          { type: "pdf", label: "Fiches exemples avant/après" },
          { type: "quiz", label: "Évaluation 70%" },
        ],
      },
      {
        step: 3,
        title: "Favoriser l'autonomie et valoriser chaque progrès",
        duration: "1 h 30",
        description: "Développer la confiance en soi de l'élève par des réussites mesurables et une alliance pédagogique bienveillante.",
        highlights: ["Contrats d'objectifs individualisés", "Tutorat entre pairs", "Entretien positif avec les parents"],
        formats: [
          { type: "video", label: "3 études de cas filmées" },
          { type: "pdf", label: "Charte de collaboration" },
          { type: "quiz", label: "Évaluation finale 70%" },
        ],
      },
    ],
  },
];

export function LearningPathsSection() {
  const [activePathId, setActivePathId] = useState<string>("fondamental");
  const activePath = LEARNING_PATHS.find((p) => p.id === activePathId) || LEARNING_PATHS[0]!;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-surface via-ink-25/50 to-surface py-16 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots opacity-25" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-700">
              <Compass className="size-4" aria-hidden />
              <span>Parcours structurés · en préparation</span>
            </p>
            <h2 className="mt-2 text-[1.875rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[2.25rem]">
              Des parcours d’apprentissage cohérents et progressifs
            </h2>
            <p className="mt-3 text-reading leading-relaxed text-ink-600">
              Ne cherchez plus au hasard : suivez des trajectoires conçues par étape pour développer une compétence
              pédagogique complète. Les parcours ci-dessous sont en préparation avec l’équipe pédagogique de la Fondation Sanady.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface/90 px-4 py-2 text-label font-medium text-ink-700 shadow-xs backdrop-blur-xs">
            <Sparkles className="size-4 text-accent-600" aria-hidden />
            <span>4 parcours en préparation</span>
          </div>
        </div>

        {/* ─── Navigation Tabs ─────────────────────────────────────────────── */}
        <div className="mt-10 flex gap-2 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-4 sm:overflow-visible">
          {LEARNING_PATHS.map((path) => {
            const isActive = path.id === activePathId;
            return (
              <button
                key={path.id}
                type="button"
                onClick={() => setActivePathId(path.id)}
                aria-pressed={isActive}
                className={`group relative flex min-w-[240px] flex-col rounded-2xl border p-4 text-left transition duration-200 sm:min-w-0 ${
                  isActive
                    ? "border-accent-600 bg-surface shadow-md ring-2 ring-accent-500/20"
                    : "border-line bg-surface/70 hover:border-line-strong hover:bg-surface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${
                      isActive ? "bg-accent-50 text-accent-800" : "bg-ink-100 text-ink-600"
                    }`}
                  >
                    {path.badge}
                  </span>
                  {isActive ? (
                    <span className="live-radar" />
                  ) : null}
                </div>
                <h3
                  className={`mt-3 line-clamp-2 text-card font-bold leading-snug transition-colors ${
                    isActive ? "text-ink-900" : "text-ink-700 group-hover:text-ink-900"
                  }`}
                >
                  {path.title}
                </h3>
                <div className="mt-2 flex items-center gap-3 text-caption text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden /> {path.totalDuration}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="size-3.5" aria-hidden /> {path.moduleCount} modules
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ─── Path Overview & Roadmap ─────────────────────────────────────── */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:items-start">
          {/* Left: Sequential Steps Roadmap */}
          <div className="rounded-3xl border border-line bg-surface p-6 shadow-xs sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
              <div>
                <span className="rounded-full bg-accent-50 px-3 py-1 text-caption font-bold text-accent-800">
                  {activePath.badge}
                </span>
                <h3 className="mt-3 text-[1.5rem] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[1.75rem]">
                  {activePath.title}
                </h3>
                <p className="mt-1 text-body text-ink-600">{activePath.subtitle}</p>
              </div>
              <div className="rounded-xl border border-line bg-ink-25/80 px-4 py-2 text-right">
                <span className="block text-caption font-medium text-ink-500">Durée totale</span>
                <span className="text-section font-bold tabular text-ink-900">{activePath.totalDuration}</span>
              </div>
            </div>

            {/* Steps Timeline (Pluralsight node visual style) */}
            <div className="mt-8 relative space-y-8 before:absolute before:bottom-6 before:left-5 before:top-6 before:w-0.5 before:bg-line-strong sm:before:left-6">
              {activePath.steps.map((step, idx) => (
                <div key={step.step} className="relative flex items-start gap-4 sm:gap-6">
                  {/* Step Node */}
                  <span className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-surface bg-brand-700 text-label sm:text-card font-extrabold text-white shadow-md ring-4 ring-ink-100">
                    0{step.step}
                  </span>

                  {/* Step Content Card */}
                  <div className="min-w-0 flex-1 rounded-2xl border border-line bg-ink-25/50 p-5 transition duration-200 hover:border-accent-500/30 hover:bg-surface hover:shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-caption font-semibold uppercase tracking-wider text-accent-700">
                        Étape {idx + 1} du parcours
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-caption font-medium text-ink-600 shadow-2xs">
                        <Clock className="size-3" aria-hidden /> {step.duration}
                      </span>
                    </div>

                    <h4 className="mt-2 text-card font-bold text-ink-900 sm:text-section">
                      {step.title}
                    </h4>
                    <p className="mt-1.5 text-body leading-relaxed text-ink-600">
                      {step.description}
                    </p>

                    {/* Highlights pill tags */}
                    <ul className="mt-3.5 flex flex-wrap gap-2">
                      {step.highlights.map((h) => (
                        <li
                          key={h}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line/80 bg-surface px-2.5 py-1 text-caption text-ink-700 shadow-2xs"
                        >
                          <Check className="size-3 text-success-600" aria-hidden />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Formats included */}
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line/60 pt-3 text-caption font-medium text-ink-500">
                      {step.formats.map((f) => (
                        <span key={f.label} className="inline-flex items-center gap-1.5">
                          {f.type === "video" ? (
                            <PlayCircle className="size-3.5 text-accent-600" aria-hidden />
                          ) : f.type === "pdf" ? (
                            <FileText className="size-3.5 text-ink-500" aria-hidden />
                          ) : (
                            <Award className="size-3.5 text-success-600" aria-hidden />
                          )}
                          <span>{f.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Path Certificate & Outcomes Card */}
          <div className="space-y-6">
            <div className="card-shine glow-card overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-md sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-700 shadow-xs">
                  <Award className="size-6" aria-hidden />
                </span>
                <div>
                  <span className="block text-caption font-bold uppercase tracking-wider text-accent-700">
                    Aboutissement
                  </span>
                  <span className="block text-card font-extrabold text-ink-900">
                    Certificat de Spécialisation
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-accent-200/80 bg-accent-50/40 p-4">
                <p className="text-caption font-medium text-accent-800">Titre délivré :</p>
                <p className="mt-1 text-card font-bold text-accent-900">
                  {activePath.certificateTitle}
                </p>
                <div className="mt-3 flex items-center gap-2 text-caption text-accent-700">
                  <QrCode className="size-4" aria-hidden />
                  <span>Délivré par la Fondation Sanady · Vérifiable en ligne</span>
                </div>
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <p className="text-label font-bold text-ink-900">Compétences clés acquises :</p>
                <ul className="mt-3 space-y-2">
                  {activePath.skills.map((s) => (
                    <li key={s} className="flex items-start gap-2.5 text-body text-ink-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <div className="flex items-center justify-between text-caption text-ink-500">
                  <span>Public ciblé :</span>
                  <span className="font-medium text-ink-800">{activePath.audience}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <Link
                  href="/formations"
                  className={buttonClasses({
                    variant: "accent",
                    size: "xl",
                    className: "btn-sheen w-full justify-center rounded-xl font-bold shadow-xs",
                  })}
                >
                  Voir les formations disponibles <ArrowRight aria-hidden />
                </Link>
                <Link
                  href="/demande-acces"
                  className={buttonClasses({
                    variant: "secondary",
                    size: "lg",
                    className: "w-full justify-center rounded-xl",
                  })}
                >
                  Demander un accès enseignant
                </Link>
              </div>
            </div>

            {/* Quick reassurance box */}
            <div className="rounded-2xl border border-line bg-ink-25/80 p-5 text-caption text-ink-600">
              <div className="flex items-center gap-2 font-semibold text-ink-900">
                <Sparkles className="size-4 text-accent-600" aria-hidden />
                <span>Progression libre & sauvegardée</span>
              </div>
              <p className="mt-1.5 leading-relaxed">
                Chaque module est indépendant. Vous progressez à votre rythme et reprenez exactement là où vous vous
                étiez arrêté, sur mobile ou ordinateur.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
