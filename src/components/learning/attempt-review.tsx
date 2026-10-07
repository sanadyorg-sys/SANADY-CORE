import { CircleCheck, CircleX } from "lucide-react";
import { Badge, Card } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDateTime, formatScore } from "@/lib/format";
import type { AttemptResult } from "@/lib/types";

/** Score banner + per-question review. Used by learners and supervisors. */
export function AttemptSummary({ result }: { result: AttemptResult }) {
  return (
    <Card className={cn("overflow-hidden", result.passed ? "border-success-600/30" : "border-danger-200")}>
      <div className={cn("flex flex-wrap items-center gap-6 px-6 py-5", result.passed ? "bg-success-50" : "bg-danger-50")}>
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-full",
            result.passed ? "bg-success-600 text-white" : "bg-danger-600 text-white",
          )}
        >
          {result.passed ? <CircleCheck className="size-7" aria-hidden /> : <CircleX className="size-7" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-section font-semibold", result.passed ? "text-success-700" : "text-danger-700")}>
            {result.passed ? "Évaluation réussie" : "Évaluation non validée"}
          </p>
          <p className="text-body text-ink-700">
            Tentative {result.attempt_number} sur {result.max_attempts} · soumise le {formatDateTime(result.submitted_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-display font-semibold text-ink-900">{formatScore(result.score_percent)}</p>
          <p className="text-label text-ink-600">
            {result.earned_points}/{result.max_points} points · seuil {result.pass_threshold} %
          </p>
        </div>
      </div>
    </Card>
  );
}

export function AttemptQuestions({ result }: { result: AttemptResult }) {
  return (
    <ol className="space-y-4">
      {result.questions.map((q, i) => (
        <li key={q.id}>
          <Card className="p-5">
            <div className="flex items-start gap-3">
              {q.is_correct ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success-600" aria-label="Réponse correcte" />
              ) : (
                <CircleX className="mt-0.5 size-5 shrink-0 text-danger-600" aria-label="Réponse incorrecte" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium uppercase tracking-wide text-ink-500">
                  Question {i + 1} · {q.points_awarded}/{q.points} point{q.points > 1 ? "s" : ""}
                </p>
                <p className="mt-1 whitespace-pre-line text-card font-semibold text-ink-900">{q.prompt}</p>
                <ul className="mt-3 space-y-2">
                  {q.options.map((o) => {
                    const chosen = q.selected_option_ids.includes(o.id);
                    const correct = o.is_correct === true;
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-body",
                          result.answers_revealed && correct
                            ? "border-success-600/40 bg-success-50"
                            : chosen
                              ? "border-ink-300 bg-ink-50"
                              : "border-line",
                        )}
                      >
                        <span className="text-ink-800">{o.label}</span>
                        <span className="flex shrink-0 gap-1.5">
                          {chosen ? <Badge tone="brand">Votre réponse</Badge> : null}
                          {result.answers_revealed && correct ? <Badge tone="success">Bonne réponse</Badge> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {q.selected_option_ids.length === 0 ? <p className="mt-2 text-label text-ink-500">Sans réponse.</p> : null}
                {q.explanation ? (
                  <div className="mt-3 rounded-md border-l-2 border-accent-600 bg-accent-50/60 px-3 py-2 text-body text-ink-700">
                    <span className="font-medium text-ink-900">Explication : </span>
                    <span className="whitespace-pre-line">{q.explanation}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}
