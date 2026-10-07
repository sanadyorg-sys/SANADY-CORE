import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, ClipboardCheck, Lock } from "lucide-react";
import { CurriculumDrawer } from "@/components/learning/curriculum-drawer";
import { QuizRunner } from "@/components/learning/quiz-runner";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDateTime, formatScore } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { QuizStatus } from "@/lib/types";
import { requireViewer } from "@/server/auth";
import { getAttempts, getCourseOutline } from "@/server/queries/learning";

export const metadata: Metadata = { title: "Évaluation" };

export default async function QuizPage(props: PageProps<"/espace/formations/[courseId]/evaluations/[quizId]">) {
  const { courseId, quizId } = await props.params;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const basePath = `/espace/formations/${courseId}`;

  const [quizRes, statusRes, outline, attempts] = await Promise.all([
    supabase.from("quizzes").select("id, title, instructions, module:modules(id, title)").eq("id", quizId).eq("course_id", courseId).maybeSingle(),
    supabase.rpc("quiz_status", { p_quiz: quizId }),
    getCourseOutline(courseId, viewer.id),
    getAttempts(viewer.id, courseId),
  ]);
  const quiz = quizRes.data as { id: string; title: string; instructions: string; module: { id: string; title: string } | null } | null;
  if (!quiz || !outline || statusRes.error) notFound();
  const status = statusRes.data as QuizStatus;
  const moduleOutline = outline.modules.find((m) => m.id === quiz.module?.id);
  const quizAttempts = attempts.filter((a) => a.quiz_id === quizId && a.status === "submitted");
  const lastSubmitted = quizAttempts[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={basePath} className="inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
          <ArrowLeft className="size-4" aria-hidden /> {outline.course.title}
        </Link>
        <CurriculumDrawer courseId={courseId} modules={outline.modules} currentQuizId={quizId} />
      </div>

      <header className="mb-6">
        <p className="text-label font-medium text-accent-700">{quiz.module?.title}</p>
        <h1 className="mt-1 text-title font-semibold text-ink-900">{quiz.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="brand">{status.question_count} question{status.question_count > 1 ? "s" : ""}</Badge>
          <Badge>Seuil de réussite : {status.pass_threshold} %</Badge>
          <Badge>
            Tentatives : {status.attempts_used}/{status.max_attempts}
          </Badge>
          {status.best_score !== null ? <Badge>Meilleur score : {formatScore(status.best_score)}</Badge> : null}
        </div>
      </header>

      {status.passed ? (
        <Alert tone="success" title="Évaluation réussie">
          Vous avez validé ce module avec un score de {formatScore(status.best_score)}.
          {lastSubmitted ? (
            <>
              {" "}
              <Link href={`${basePath}/evaluations/${quizId}/resultats/${lastSubmitted.id}`}>Consulter le détail de vos réponses</Link>.
            </>
          ) : null}
        </Alert>
      ) : status.exhausted ? (
        <Alert tone="danger" title="Tentatives épuisées">
          Vous avez utilisé vos {status.max_attempts} tentatives sans atteindre le seuil de {status.pass_threshold} %. Une intervention de
          l’administration SANADY est nécessaire pour vous permettre de repasser cette évaluation. Votre établissement ou l’équipe SANADY
          peut vous accompagner sur les points à retravailler.
        </Alert>
      ) : !status.unlocked ? (
        <Card>
          <CardHeader title="Évaluation verrouillée" description="Terminez d’abord les leçons obligatoires du module." />
          <CardBody>
            <ul className="space-y-2">
              {moduleOutline?.lessons
                .filter((l) => l.is_mandatory)
                .map((l) => (
                  <li key={l.id} className="flex items-center gap-3">
                    {l.status === "completed" ? (
                      <CircleCheck className="size-4 text-success-600" aria-label="Terminée" />
                    ) : (
                      <Lock className="size-4 text-ink-400" aria-label="À terminer" />
                    )}
                    <Link href={`${basePath}/lecons/${l.id}`} className="text-body text-ink-800 hover:underline">
                      {l.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-accent-600" aria-hidden />
                <div className="space-y-2 text-body text-ink-700">
                  {quiz.instructions ? <p className="whitespace-pre-line">{quiz.instructions}</p> : null}
                  <ul className="list-disc space-y-1 pl-5 text-ink-600">
                    <li>Score minimum pour valider le module : {status.pass_threshold} %.</li>
                    <li>
                      {status.max_attempts} tentatives au total ; il vous en reste {status.remaining_attempts}.
                    </li>
                    <li>Vos réponses sont corrigées à la soumission. Les questions non répondues sont comptées comme incorrectes.</li>
                    <li>Pour une question à réponses multiples, toutes les bonnes réponses doivent être sélectionnées.</li>
                  </ul>
                </div>
              </div>
              {status.attempts_used > 0 && !status.open_attempt_id ? (
                <Alert tone="warning">
                  Votre dernière tentative n’a pas atteint le seuil requis. Il vous reste {status.remaining_attempts} tentative
                  {status.remaining_attempts > 1 ? "s" : ""}. Nous vous conseillons de revoir les leçons du module avant de recommencer.
                </Alert>
              ) : null}
            </CardBody>
          </Card>
          <QuizRunner
            quizId={quizId}
            courseId={courseId}
            resultsBasePath={`${basePath}/evaluations/${quizId}`}
            hasOpenAttempt={Boolean(status.open_attempt_id)}
            attemptsLeft={status.remaining_attempts}
          />
        </div>
      )}

      {quizAttempts.length ? (
        <Card className="mt-8">
          <CardHeader title="Historique des tentatives" />
          <Table caption="Historique des tentatives">
            <THead>
              <tr>
                <TH>Tentative</TH>
                <TH>Date</TH>
                <TH align="right">Score</TH>
                <TH>Résultat</TH>
                <TH align="right">
                  <span className="sr-only">Détail</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {quizAttempts.map((a) => (
                <TR key={a.id}>
                  <TD>
                    n° {a.attempt_number}
                    {a.voided_at ? <span className="ml-2 text-caption text-ink-500">(réinitialisée)</span> : null}
                  </TD>
                  <TD>{formatDateTime(a.submitted_at)}</TD>
                  <TD align="right">{formatScore(a.score_percent)}</TD>
                  <TD>{a.passed ? <Badge tone="success">Réussie</Badge> : <Badge tone="danger">Non validée</Badge>}</TD>
                  <TD align="right">
                    <Link
                      href={`${basePath}/evaluations/${quizId}/resultats/${a.id}`}
                      className={buttonClasses({ variant: "ghost", size: "sm" })}
                    >
                      Détail
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
