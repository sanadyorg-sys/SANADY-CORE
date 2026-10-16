import { redirect } from "next/navigation";

/** In the client preview, an evaluation link shows its questions on the overview (answers are never sent). */
export default async function ClientQuizPreviewPage(props: PageProps<"/etablissement/[institutionId]/projets/[projectId]/apercu/evaluations/[quizId]">) {
  const { institutionId, projectId, quizId } = await props.params;
  redirect(`/etablissement/${institutionId}/projets/${projectId}/apercu#evaluation-${encodeURIComponent(quizId)}`);
}
