import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CourseStatusActions } from "@/components/admin/course-status-actions";
import { Alert, Badge, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { COURSE_STATUSES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";
import { requireStaff } from "@/server/auth";

type CourseHeader = Pick<Course, "id" | "title" | "status" | "updated_at" | "published_at"> & {
  submitted_at: string | null;
  review_comment: string | null;
  reviewed_at: string | null;
};

export default async function CourseEditorLayout(props: LayoutProps<"/admin/formations/[courseId]">) {
  const { courseId } = await props.params;
  const viewer = await requireStaff();
  const supabase = await createClient();
  const [{ data }, { count }, { data: trainerRow }] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, status, updated_at, published_at, submitted_at, review_comment, reviewed_at")
      .eq("id", courseId)
      .maybeSingle(),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("status", "active"),
    viewer.isTrainer
      ? supabase.from("course_trainers").select("id").eq("course_id", courseId).eq("user_id", viewer.id).maybeSingle()
      : Promise.resolve({ data: { id: "staff" } }),
  ]);
  const course = data as CourseHeader | null;
  // A trainer only opens the courses assigned to them (even if enrolled elsewhere as a learner).
  if (!course || !trainerRow) notFound();
  const base = `/admin/formations/${courseId}`;
  const tone = course.status === "published" ? "success" : course.status === "archived" ? "warning" : course.status === "review" ? "accent" : "neutral";
  const locked = viewer.isTrainer && course.status !== "draft";

  return (
    <>
      <Link href="/admin/formations" className="mb-5 inline-flex min-h-6 items-center gap-1.5 py-1 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> {viewer.isTrainer ? "Mes formations" : "Formations"}
      </Link>
      <PageHeader
        title={course.title}
        eyebrow={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={tone} dot>
              {COURSE_STATUSES[course.status]}
            </Badge>
            <span>Modifiée le {formatDateTime(course.updated_at)}</span>
          </span>
        }
        actions={
          <CourseStatusActions courseId={courseId} status={course.status} activeLearners={count ?? 0} canPublish={viewer.isCourseStaff} />
        }
      />
      {course.status === "draft" && course.review_comment ? (
        <Alert tone="warning" title="Modifications demandées par l’équipe SANADY" className="mb-6">
          <p className="whitespace-pre-line">{course.review_comment}</p>
          {course.reviewed_at ? <p className="mt-1 text-caption">Le {formatDateTime(course.reviewed_at)}</p> : null}
        </Alert>
      ) : null}
      {course.status === "review" ? (
        <Alert tone="info" title="Formation en revue" className="mb-6">
          {viewer.isCourseStaff
            ? "Vérifiez le contenu (onglet Publication pour l’aperçu), puis approuvez-la ou demandez des modifications."
            : "L’équipe SANADY relit votre formation. Le contenu est verrouillé jusqu’à sa décision."}
          {course.submitted_at ? ` Soumise le ${formatDateTime(course.submitted_at)}.` : ""}
        </Alert>
      ) : null}
      {locked && course.status !== "review" ? (
        <Alert tone="info" className="mb-6">
          Cette formation est {COURSE_STATUSES[course.status].toLowerCase()} : seule l’équipe SANADY peut la modifier. Vous pouvez la consulter.
        </Alert>
      ) : null}
      <LinkTabs
        className="mb-6"
        items={[
          { href: base, label: "Informations", exact: true },
          { href: `${base}/programme`, label: "Programme" },
          ...(viewer.isCourseStaff ? [{ href: `${base}/formateurs`, label: "Formateurs" }] : []),
          ...(viewer.isSanadyAdmin ? [{ href: `${base}/autorisations`, label: "Autorisations" }] : []),
          { href: `${base}/publication`, label: viewer.isTrainer ? "Aperçu et soumission" : "Publication" },
        ]}
      />
      {props.children}
    </>
  );
}
