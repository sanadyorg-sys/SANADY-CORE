import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { LessonContentEditor, LessonDetailsForm, ResourcesEditor } from "@/components/admin/lesson-editor";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { LESSON_KINDS } from "@/lib/labels";
import { serverEnv } from "@/lib/server-env";
import { requireSanadyAdmin } from "@/server/auth";
import { getLessonEditorData } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Leçon" };

export default async function LessonEditorPage(props: PageProps<"/admin/formations/[courseId]/programme/lecons/[lessonId]">) {
  const { courseId, lessonId } = await props.params;
  await requireSanadyAdmin();
  const data = await getLessonEditorData(lessonId);
  if (!data || data.lesson.course_id !== courseId || data.lesson.archived_at) notFound();
  const { lesson, resources } = data;
  const base = `/admin/formations/${courseId}`;
  const hasContent = Boolean(lesson.video_ref || lesson.pdf_path);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`${base}/programme`} className="inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
          <ArrowLeft className="size-4" aria-hidden /> Programme{lesson.module ? ` · ${lesson.module.title}` : ""}
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="brand">{LESSON_KINDS[lesson.kind]}</Badge>
          {hasContent ? (
            <Link href={`${base}/apercu/lecons/${lesson.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Eye aria-hidden /> Aperçu enseignant
            </Link>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="self-start">
          <CardHeader title="Détails de la leçon" />
          <CardBody>
            <LessonDetailsForm lesson={lesson} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contenu" description="Les fichiers sont stockés de manière privée et diffusés par liens temporaires aux seuls enseignants autorisés." />
            <CardBody>
              <LessonContentEditor lesson={lesson} muxConfigured={Boolean(serverEnv.mux)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Ressources complémentaires" description="Documents téléchargeables proposés sous la leçon." />
            <CardBody>
              <ResourcesEditor lesson={lesson} resources={resources} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
