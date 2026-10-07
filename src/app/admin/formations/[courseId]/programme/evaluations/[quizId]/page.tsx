import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QuestionList, QuizSettingsForm } from "@/components/admin/quiz-editor";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { requireSanadyAdmin } from "@/server/auth";
import { getQuizEditorData } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Évaluation" };

export default async function QuizEditorPage(props: PageProps<"/admin/formations/[courseId]/programme/evaluations/[quizId]">) {
  const { courseId, quizId } = await props.params;
  await requireSanadyAdmin();
  const data = await getQuizEditorData(quizId);
  if (!data || data.quiz.course_id !== courseId) notFound();
  const { quiz, questions } = data;

  return (
    <>
      <Link
        href={`/admin/formations/${courseId}/programme`}
        className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> Programme{quiz.module ? ` · ${quiz.module.title}` : ""}
      </Link>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title="Paramètres" />
            <CardBody>
              <QuizSettingsForm quiz={quiz} />
            </CardBody>
          </Card>
          <Alert tone="info" title="Règles d’évaluation">
            Seuil de réussite : {quiz.pass_threshold} % · {quiz.max_attempts} tentatives. Une question à réponses multiples n’est juste que si
            toutes les bonnes réponses, et elles seules, sont sélectionnées. La correction a lieu sur le serveur.
          </Alert>
        </div>
        <section>
          <h2 className="mb-3 text-section font-semibold text-ink-900">Questions</h2>
          <QuestionList quiz={quiz} questions={questions} />
        </section>
      </div>
    </>
  );
}
