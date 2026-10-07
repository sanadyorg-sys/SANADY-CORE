import { formatScore } from "./format";

export interface QuizStatusLike {
  passed: boolean;
  exhausted: boolean;
  unlocked: boolean;
  open_attempt_id: string | null;
  attempts_used: number;
  max_attempts: number;
  best_score: number | null;
}

/** Short French status for a module quiz, with a tone for styling. */
export function quizStatusLabel(quiz: QuizStatusLike) {
  if (quiz.passed) return { text: `Réussie · ${formatScore(quiz.best_score)}`, tone: "success" as const };
  if (quiz.exhausted) return { text: "Tentatives épuisées", tone: "danger" as const };
  if (!quiz.unlocked) return { text: "Après les leçons", tone: "muted" as const };
  if (quiz.open_attempt_id) return { text: "En cours", tone: "teal" as const };
  if (quiz.attempts_used > 0) return { text: `${quiz.max_attempts - quiz.attempts_used} tentative(s) restante(s)`, tone: "warning" as const };
  return { text: "Disponible", tone: "teal" as const };
}
