"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Send } from "lucide-react";
import { startQuizAttempt, submitQuizAttempt } from "@/server/actions/quiz";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Alert, Card } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import type { StartedAttempt } from "@/lib/types";

const storageKey = (attemptId: string) => `sanady:attempt:${attemptId}`;

function loadDraft(attemptId: string): Record<string, string[]> {
  try {
    const raw = sessionStorage.getItem(storageKey(attemptId));
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

/**
 * Assessment runner. Questions arrive without any correctness data; answers
 * are kept in session storage so a refresh never loses work, then graded on
 * the server at submission.
 */
export function QuizRunner({
  quizId,
  courseId,
  resultsBasePath,
  hasOpenAttempt,
  attemptsLeft,
}: {
  quizId: string;
  courseId: string;
  resultsBasePath: string;
  hasOpenAttempt: boolean;
  attemptsLeft: number;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();

  useEffect(() => {
    if (!attempt) return;
    try {
      sessionStorage.setItem(storageKey(attempt.attempt_id), JSON.stringify(answers));
    } catch {
      /* storage unavailable: answers stay in memory */
    }
  }, [answers, attempt]);

  const begin = () =>
    startTransition(async () => {
      setError(null);
      const res = await startQuizAttempt(quizId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setAttempt(res.attempt);
      setAnswers(loadDraft(res.attempt.attempt_id));
      setIndex(0);
    });

  if (!attempt) {
    return (
      <div className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button size="lg" onClick={begin} loading={starting}>
          {hasOpenAttempt ? "Reprendre ma tentative" : "Commencer l’évaluation"}
          <ArrowRight aria-hidden />
        </Button>
        {!hasOpenAttempt ? (
          <p className="text-caption text-ink-500">
            Commencer l’évaluation utilise une tentative ({attemptsLeft} restante{attemptsLeft > 1 ? "s" : ""}). Vous pourrez quitter la
            page et reprendre cette même tentative plus tard.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Runner
      attempt={attempt}
      answers={answers}
      setAnswers={setAnswers}
      index={index}
      setIndex={setIndex}
      onSubmit={async () => {
        const res = await submitQuizAttempt(attempt.attempt_id, answers, courseId);
        if (!res.ok) return { ok: false, message: res.message };
        try {
          sessionStorage.removeItem(storageKey(attempt.attempt_id));
        } catch {
          /* ignore */
        }
        router.push(`${resultsBasePath}/resultats/${res.attemptId}`);
        return { ok: true };
      }}
    />
  );
}

function Runner({
  attempt,
  answers,
  setAnswers,
  index,
  setIndex,
  onSubmit,
}: {
  attempt: StartedAttempt;
  answers: Record<string, string[]>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  index: number;
  setIndex: (i: number) => void;
  onSubmit: () => Promise<{ ok: boolean; message?: string }>;
}) {
  const questions = attempt.questions;
  const question = questions[index]!;
  const selected = answers[question.id] ?? [];
  const answeredCount = useMemo(() => questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length, [answers, questions]);
  const unanswered = questions.length - answeredCount;

  const choose = (optionId: string) =>
    setAnswers((prev) => {
      const current = prev[question.id] ?? [];
      if (question.kind === "single") return { ...prev, [question.id]: [optionId] };
      return {
        ...prev,
        [question.id]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId],
      };
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <Card className="p-5 sm:p-7">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-label text-ink-500">
            <span>
              Question <span className="tabular font-semibold text-ink-900">{index + 1}</span> sur {questions.length}
            </span>
            <span>
              Tentative {attempt.attempt_number} sur {attempt.max_attempts}
            </span>
          </div>
          <ProgressBar value={answeredCount / questions.length} label="Questions répondues" size="sm" />
        </div>

        <fieldset key={question.id}>
          <legend className="w-full">
            <span className="block whitespace-pre-line text-section font-semibold text-ink-900">{question.prompt}</span>
            <span className="mt-1.5 block text-label text-ink-500">
              {question.kind === "single" ? "Une seule réponse possible" : "Plusieurs réponses possibles — sélectionnez toutes les bonnes réponses"}
              {question.points > 1 ? ` · ${question.points} points` : ""}
            </span>
          </legend>
          <div className="mt-5 space-y-2.5">
            {question.options.map((option, oi) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                    checked ? "border-accent-600 bg-accent-50/60 ring-1 ring-accent-600" : "border-line-strong hover:border-ink-400 hover:bg-ink-25",
                  )}
                >
                  <input
                    type={question.kind === "single" ? "radio" : "checkbox"}
                    name={`q-${question.id}`}
                    value={option.id}
                    checked={checked}
                    onChange={() => choose(option.id)}
                    className="mt-1 size-4 shrink-0 accent-accent-600"
                  />
                  <span className="text-reading text-ink-800">
                    <span className="sr-only">Réponse {String.fromCharCode(65 + oi)} : </span>
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={() => setIndex(index - 1)} disabled={index === 0}>
            <ArrowLeft aria-hidden /> Précédente
          </Button>
          {index < questions.length - 1 ? (
            <Button onClick={() => setIndex(index + 1)}>
              Suivante <ArrowRight aria-hidden />
            </Button>
          ) : (
            <SubmitAttempt unanswered={unanswered} onSubmit={onSubmit} />
          )}
        </div>
      </Card>

      <aside className="space-y-4">
        <Card className="p-4">
          <p className="mb-3 text-label font-semibold text-ink-900">Navigation</p>
          <ol className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {questions.map((q, i) => {
              const answered = (answers[q.id]?.length ?? 0) > 0;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={i === index ? "step" : undefined}
                    aria-label={`Question ${i + 1}${answered ? ", répondue" : ", sans réponse"}`}
                    className={cn(
                      "tabular flex size-9 w-full items-center justify-center rounded-md border text-label font-medium",
                      i === index && "ring-2 ring-brand-700 ring-offset-1",
                      answered ? "border-accent-600 bg-accent-600 text-white" : "border-line-strong bg-surface text-ink-700 hover:bg-ink-50",
                    )}
                  >
                    {answered ? <Check className="size-3.5" aria-hidden /> : i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-caption text-ink-500">
            {answeredCount}/{questions.length} répondue{answeredCount > 1 ? "s" : ""}
          </p>
        </Card>
        <div className="hidden lg:block">
          <SubmitAttempt unanswered={unanswered} onSubmit={onSubmit} variant="secondary" full />
        </div>
      </aside>
    </div>
  );
}

function SubmitAttempt({
  unanswered,
  onSubmit,
  variant = "accent",
  full = false,
}: {
  unanswered: number;
  onSubmit: () => Promise<{ ok: boolean; message?: string }>;
  variant?: "accent" | "secondary";
  full?: boolean;
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant={variant} className={full ? "w-full" : undefined}>
          <Send aria-hidden /> Terminer et soumettre
        </Button>
      }
      title="Soumettre vos réponses ?"
      description={
        unanswered > 0
          ? `${unanswered} question${unanswered > 1 ? "s restent" : " reste"} sans réponse et ${unanswered > 1 ? "seront comptées" : "sera comptée"} comme incorrecte${unanswered > 1 ? "s" : ""}. Une fois soumise, la tentative ne peut plus être modifiée.`
          : "Une fois soumise, la tentative ne peut plus être modifiée."
      }
      confirmLabel="Soumettre"
      confirmVariant="accent"
      onConfirm={onSubmit}
    />
  );
}
