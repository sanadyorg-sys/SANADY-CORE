import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, RotateCcw } from "lucide-react";
import { AttemptQuestions, AttemptSummary } from "@/components/learning/attempt-review";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/server";
import type { AttemptResult } from "@/lib/types";
import { requireViewer } from "@/server/auth";
import { getCourseOutline } from "@/server/queries/learning";

export const metadata: Metadata = { title: "Résultats de l’évaluation" };

export default async function AttemptResultPage(
  props: PageProps<"/espace/formations/[courseId]/evaluations/[quizId]/resultats/[attemptId]">,
) {
  const { courseId, quizId, attemptId } = await props.params;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const basePath = `/espace/formations/${courseId}`;

  const [{ data, error }, outline, cert] = await Promise.all([
    supabase.rpc("get_attempt_result", { p_attempt: attemptId }),
    getCourseOutline(courseId, viewer.id),
    supabase.from("certificates").select("id").eq("course_id", courseId).eq("user_id", viewer.id).is("revoked_at", null).maybeSingle(),
  ]);
  if (error || !data || !outline) notFound();
  const result = data as AttemptResult;
  if (result.quiz_id !== quizId || result.course_id !== courseId) notFound();

  // Next step after this module.
  const moduleIndex = outline.modules.findIndex((m) => m.quiz?.id === quizId);
  const nextModule = outline.modules[moduleIndex + 1];
  const nextHref = nextModule?.lessons[0] ? `${basePath}/lecons/${nextModule.lessons[0].id}` : null;
  const canRetry = !result.passed && !result.voided && (result.remaining_attempts ?? 0) > 0;
  const exhausted = !result.passed && !result.voided && result.remaining_attempts === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={basePath} className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> {outline.course.title}
      </Link>
      <h1 className="mb-6 text-title font-semibold text-ink-900">Résultats de l’évaluation</h1>

      <AttemptSummary result={result} />

      <div className="mt-5 flex flex-wrap gap-3">
        {cert.data ? (
          <Link href="/espace/certificats" className={buttonClasses({ size: "lg" })}>
            <Award aria-hidden /> Voir mon certificat
          </Link>
        ) : result.passed && nextHref ? (
          <Link href={nextHref} className={buttonClasses({ size: "lg" })}>
            Module suivant <ArrowRight aria-hidden />
          </Link>
        ) : null}
        {canRetry ? (
          <Link href={`${basePath}/evaluations/${quizId}`} className={buttonClasses({ variant: result.passed ? "secondary" : "primary", size: "lg" })}>
            <RotateCcw aria-hidden /> Nouvelle tentative ({result.remaining_attempts} restante{(result.remaining_attempts ?? 0) > 1 ? "s" : ""})
          </Link>
        ) : null}
        <Link href={basePath} className={buttonClasses({ variant: "secondary", size: "lg" })}>
          Retour à la formation
        </Link>
      </div>

      {result.passed && cert.data ? (
        <Alert tone="success" title="Formation terminée" className="mt-6">
          Toutes les leçons obligatoires et toutes les évaluations sont validées : votre certificat a été délivré.
        </Alert>
      ) : null}
      {exhausted ? (
        <Alert tone="danger" title="Tentatives épuisées" className="mt-6">
          Vous avez utilisé toutes vos tentatives pour cette évaluation. Une intervention de l’administration SANADY est nécessaire pour
          poursuivre.
        </Alert>
      ) : null}
      {!result.passed && !result.answers_revealed ? (
        <Alert tone="info" className="mt-6">
          Les bonnes réponses ne sont pas affichées afin que vos prochaines tentatives restent représentatives. Appuyez-vous sur les
          explications et revoyez les leçons du module.
        </Alert>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-4 text-section font-semibold text-ink-900">Détail des réponses</h2>
        <AttemptQuestions result={result} />
      </section>
    </div>
  );
}
