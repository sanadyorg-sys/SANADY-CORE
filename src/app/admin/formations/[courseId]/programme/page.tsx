import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CurriculumEditor } from "@/components/admin/curriculum-editor";
import { Alert } from "@/components/ui/surface";
import { requireSanadyAdmin } from "@/server/auth";
import { getCourseEditorData } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Programme" };

export default async function CurriculumPage(props: PageProps<"/admin/formations/[courseId]/programme">) {
  const { courseId } = await props.params;
  await requireSanadyAdmin();
  const data = await getCourseEditorData(courseId);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      {data.course.status === "published" ? (
        <Alert tone="info" title="Formation publiée">
          Les modifications sont immédiatement visibles des enseignants. Les éléments déjà commencés par des enseignants ne sont jamais
          supprimés : ils sont archivés afin de préserver leur progression et leurs résultats.
        </Alert>
      ) : null}
      <CurriculumEditor courseId={courseId} modules={data.modules} />
    </div>
  );
}
