import { redirect } from "next/navigation";

/** In preview, assessment links open the quiz editor. */
export default async function PreviewQuizRedirect(props: PageProps<"/admin/formations/[courseId]/apercu/evaluations/[quizId]">) {
  const { courseId, quizId } = await props.params;
  redirect(`/admin/formations/${courseId}/programme/evaluations/${quizId}`);
}
