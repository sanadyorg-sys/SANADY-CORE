import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerView } from "@/components/learning/player-view";
import { Alert } from "@/components/ui/surface";
import { requireSanadyAdmin } from "@/server/auth";
import { getPlayerData } from "@/server/queries/player";

export const metadata: Metadata = { title: "Aperçu" };

export default async function LessonPreviewPage(props: PageProps<"/admin/formations/[courseId]/apercu/lecons/[lessonId]">) {
  const { courseId, lessonId } = await props.params;
  const viewer = await requireSanadyAdmin();
  const basePath = `/admin/formations/${courseId}/apercu`;
  const data = await getPlayerData(courseId, lessonId, viewer.id, { preview: true, basePath });
  if (!data) notFound();
  if ("error" in data) return <Alert tone="warning">{data.error}</Alert>;

  return (
    <PlayerView
      data={data}
      courseId={courseId}
      basePath={basePath}
      backHref={`/admin/formations/${courseId}/programme`}
      backLabel="Retour au programme"
      preview
    />
  );
}
