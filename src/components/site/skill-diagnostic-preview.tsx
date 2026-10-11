"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
}

interface DiagnosticQuestion {
  id: string;
  theme: string;
  title: string;
  scenario: string;
  options: QuizOption[];
  recommendedCourse: {
    title: string;
    href: string;
    duration: string;
  };
}

const QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "retroaction",
    theme: "Rétroaction & Évaluation",
    title: "Cas pratique : Corriger sans décourager",
    scenario:
      "Lors d’un exercice de production écrite, plusieurs élèves reproduisent systématiquement la même confusion syntaxique. Quelle attitude formative est la plus efficace selon les approches modernes recommandées par SANADY ?",
    options: [
      {
        id: "a",
        text: "Corriger individuellement au stylo rouge avec la solution écrite et exiger de recopier 3 fois la bonne réponse.",
        isCorrect: false,
        explanation:
          "La correction passive ne sollicite pas la réflexion de l'élève. L'erreur est effacée mécaniquement sans être comprise.",
      },
      {
        id: "b",
        text: "Projeter ou copier au tableau une phrase type anonymisée et animer une co-analyse guidée où les élèves identifient et explicitent eux-mêmes la règle.",
        isCorrect: true,
        explanation:
          "Excellent ! L'analyse collective dédramatise l'erreur, développe la métacognition et transforme un obstacle individuel en levier d'apprentissage partagé.",
      },
      {
        id: "c",
        text: "Attribuer une note sanction pour motiver l'effort et passer immédiatement à la leçon suivante.",
        isCorrect: false,
        explanation:
          "La sanction chiffrée sans accompagnement didactique accroît l'anxiété de performance et installe durablement les lacunes.",
      },
    ],
    recommendedCourse: {
      title: "Donner une rétroaction efficace et constructive",
      href: "/formations",
      duration: "2 h · 4 modules",
    },
  },
  {
    id: "differentiation",
    theme: "Gestion de l’Hétérogénéité",
    title: "Cas pratique : Gérer les rythmes d’apprentissage contrastés",
    scenario:
      "En classe de calcul, un quart des élèves termine la fiche d’exercices en 8 minutes tandis que d’autres peinent à démarrer la première opération. Comment équilibrer la séance ?",
    options: [
      {
        id: "a",
        text: "Demander aux élèves rapides d’attendre en silence ou de relire le manuel sans consigne précise.",
        isCorrect: false,
        explanation:
          "Le désœuvrement engendre l'ennui et perturbe souvent la concentration des autres élèves.",
      },
      {
        id: "b",
        text: "Proposer aux élèves rapides des défis ouverts de réinvestissement, tout en animant un atelier guidé de manipulation avec le petit groupe en difficulté.",
        isCorrect: true,
        explanation:
          "Parfait ! C’est le principe même de la pédagogie différenciée : maintenir un haut niveau d'exigence pour tous sans abandonner ceux qui ont besoin d'étayage.",
      },
      {
        id: "c",
        text: "Donner aux élèves rapides le double d'exercices identiques et répétitifs pour les occuper.",
        isCorrect: false,
        explanation:
          "La surcharge quantitative sans stimulation cognitive démotive les élèves avancés sans aider les élèves en difficulté.",
      },
    ],
    recommendedCourse: {
      title: "Remédiation pédagogique et activités par niveau réel",
      href: "/formations",
      duration: "2 h 30 · Approche TaRL",
    },
  },
];

export function SkillDiagnosticPreview() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const q = QUESTIONS[currentIdx]!;
  const selectedOption = q.options.find((o) => o.id === selectedOptionId) || null;
  const isAnswered = selectedOption !== null;

  function handleSelect(id: string) {
    if (!isAnswered) {
      setSelectedOptionId(id);
    }
  }

  function handleReset() {
    setSelectedOptionId(null);
  }

  function handleSwitchQuestion(idx: number) {
    setCurrentIdx(idx);
    setSelectedOptionId(null);
  }

  return (
    <section className="relative overflow-hidden bg-brand-800 py-16 text-white sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots-light opacity-10" />
      <div aria-hidden className="pointer-events-none absolute -left-20 top-1/2 size-96 -translate-y-1/2 rounded-full bg-accent-600/10 blur-3xl animate-aurora" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.35fr] lg:items-center">
          {/* Left Column: Context & Educational Engine */}
          <div>
            <p className="inline-flex items-center gap-2 text-label font-bold uppercase tracking-wider text-accent-400">
              <Sparkles className="size-4" aria-hidden />
              <span>Inspiration Pluralsight · Diagnostic Formatif</span>
            </p>
            <h2 className="mt-3 text-[1.875rem] font-extrabold leading-tight tracking-tight sm:text-[2.25rem]">
              Mesurez vos réflexes pédagogiques en situation réelle
            </h2>
            <p className="mt-4 text-reading leading-relaxed text-brand-200">
              Sur SANADY, les évaluations ne sont pas des contrôles piégeux, mais des opportunités concrètes de
              consolider vos acquis. Testez un cas d’école interactif pour découvrir notre méthode de formation.
            </p>

            <div className="mt-8 space-y-3.5">
              {[
                {
                  title: "Seuil d’exigence à 70 %",
                  desc: "Garantit la maîtrise des compétences clés avant la délivrance du certificat.",
                },
                {
                  title: "3 tentatives et explications détaillées",
                  desc: "Chaque réponse est expliquée pour comprendre le raisonnement didactique sous-jacent.",
                },
                {
                  title: "Certificat sécurisé avec QR code",
                  desc: "Authentifiable par votre direction et vos inspecteurs en un clic.",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xs">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-400" aria-hidden />
                  <div>
                    <h3 className="text-card font-bold text-white">{item.title}</h3>
                    <p className="mt-0.5 text-caption leading-relaxed text-brand-200">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-3">
              <span className="text-label text-brand-300">Autre cas d’étude :</span>
              {QUESTIONS.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSwitchQuestion(idx)}
                  className={`rounded-xl px-3 py-1.5 text-label font-semibold transition ${
                    currentIdx === idx
                      ? "bg-accent-700 text-white shadow-xs"
                      : "border border-white/20 bg-white/5 text-brand-200 hover:bg-white/10"
                  }`}
                >
                  Cas {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Interactive Diagnostic Sandbox */}
          <div className="relative rounded-3xl border border-white/15 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-md sm:p-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent-500/20 px-3 py-1 text-caption font-semibold text-accent-300">
                <ClipboardCheck className="size-3.5" aria-hidden />
                <span>{q.theme}</span>
              </span>
              <span className="text-caption font-medium text-brand-300">
                Question {currentIdx + 1} sur {QUESTIONS.length}
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-card font-bold text-white sm:text-section">{q.title}</h3>
              <p className="mt-2 text-body leading-relaxed text-brand-100 sm:text-[0.9375rem]">{q.scenario}</p>
            </div>

            {/* Options List */}
            <div className="mt-6 space-y-3">
              {q.options.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                let optionStyle = "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]";

                if (isAnswered) {
                  if (opt.isCorrect) {
                    optionStyle = "border-success-500/80 bg-success-600/25 text-white ring-1 ring-success-500/40";
                  } else if (isSelected && !opt.isCorrect) {
                    optionStyle = "border-danger-500/80 bg-danger-600/25 text-white ring-1 ring-danger-500/40";
                  } else {
                    optionStyle = "border-white/5 bg-white/[0.02] text-brand-300 opacity-60";
                  }
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleSelect(opt.id)}
                    className={`group flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition duration-200 ${optionStyle}`}
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-bold ${
                        isAnswered && opt.isCorrect
                          ? "bg-success-500 text-white"
                          : isAnswered && isSelected && !opt.isCorrect
                            ? "bg-danger-500 text-white"
                            : "border border-white/20 bg-white/10 text-brand-200"
                      }`}
                    >
                      {opt.id.toUpperCase()}
                    </span>
                    <span className="flex-1 text-body leading-relaxed">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {/* Feedback & Recommendation Banner */}
            {isAnswered && selectedOption ? (
              <div
                className={`mt-6 rounded-2xl border p-5 animate-fade-up transition-all duration-300 ${
                  selectedOption.isCorrect
                    ? "border-success-500/40 bg-success-950/40 shadow-lg shadow-success-950/50"
                    : "border-warning-500/40 bg-warning-950/40 shadow-lg shadow-warning-950/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {selectedOption.isCorrect ? (
                    <CheckCircle2 className="size-5 text-success-400" aria-hidden />
                  ) : (
                    <Lightbulb className="size-5 text-warning-400" aria-hidden />
                  )}
                  <span className="text-card font-bold">
                    {selectedOption.isCorrect ? "Réponse exemplaire !" : "Analyse didactique"}
                  </span>
                </div>

                <p className="mt-2 text-body leading-relaxed text-brand-100">
                  {selectedOption.explanation}
                </p>

                {/* Course Recommendation Card */}
                <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 sm:flex-row sm:items-center">
                  <div>
                    <span className="text-caption font-medium text-accent-300">
                      Module recommandé pour approfondir :
                    </span>
                    <span className="block text-label font-bold text-white">
                      {q.recommendedCourse.title}
                    </span>
                  </div>
                  <Link
                    href={q.recommendedCourse.href}
                    className="btn-sheen inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-700 px-3.5 py-1.5 text-label font-semibold text-white shadow-xs transition hover:bg-accent-800 hover:shadow-md"
                  >
                    Découvrir <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 text-caption font-semibold text-brand-300 hover:text-white"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Réessayer ce cas
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
