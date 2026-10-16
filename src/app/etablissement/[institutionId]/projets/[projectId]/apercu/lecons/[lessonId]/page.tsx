import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerView } from "@/components/learning/player-view";
import { Alert } from "@/components/ui/surface";
import { uuidSchema } from "@/lib/validation";
import { requireInstitutionAdmin } from "@/server/auth";
import { getPlayerData } from "@/server/queries/player";
import { clientCoursePreview } from "@/server/queries/studio";

export const metadata: Metadata = { title: "Aperçu d’une leçon" };

/** A lesson of the draft course, for the company's administrators (preview: nothing is recorded). */
export default async function ClientLessonPreviewPage(props: PageProps<"/etablissement/[institutionId]/projets/[projectId]/apercu/lecons/[lessonId]">) {
  const { institutionId, projectId, lessonId } = await props.params;
  const { viewer, institution } = await requireInstitutionAdmin(institutionId);
  if (institution.kind !== "enterprise" || !uuidSchema.safeParse(projectId).success || !uuidSchema.safeParse(lessonId).success) notFound();
  const preview = await clientCoursePreview(projectId);
  if (!preview) notFound();
  const basePath = `/etablissement/${institutionId}/projets/${projectId}/apercu`;
  const data = await getPlayerData(preview.course_id, lessonId, viewer.id, { preview: true, basePath });
  if (!data) notFound();
  if ("error" in data) return <Alert tone="warning">{data.error}</Alert>;

  return <PlayerView data={data} courseId={preview.course_id} basePath={basePath} backHref={basePath} backLabel="Retour à l’aperçu" preview audience="un collaborateur" />;
}
