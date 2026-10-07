import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CourseStatusActions } from "@/components/admin/course-status-actions";
import { Badge, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { COURSE_STATUSES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";
import { requireSanadyAdmin } from "@/server/auth";

export default async function CourseEditorLayout(props: LayoutProps<"/admin/formations/[courseId]">) {
  const { courseId } = await props.params;
  await requireSanadyAdmin();
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase.from("courses").select("id, title, status, updated_at, published_at").eq("id", courseId).maybeSingle(),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("status", "active"),
  ]);
  const course = data as Pick<Course, "id" | "title" | "status" | "updated_at" | "published_at"> | null;
  if (!course) notFound();
  const base = `/admin/formations/${courseId}`;
  const tone = course.status === "published" ? "success" : course.status === "archived" ? "warning" : "neutral";

  return (
    <>
      <Link href="/admin/formations" className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Formations
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
        actions={<CourseStatusActions courseId={courseId} status={course.status} activeLearners={count ?? 0} />}
      />
      <LinkTabs
        className="mb-6"
        items={[
          { href: base, label: "Informations", exact: true },
          { href: `${base}/programme`, label: "Programme" },
          { href: `${base}/autorisations`, label: "Autorisations" },
          { href: `${base}/publication`, label: "Publication" },
        ]}
      />
      {props.children}
    </>
  );
}
