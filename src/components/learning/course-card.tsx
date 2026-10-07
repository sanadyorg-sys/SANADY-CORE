import Link from "next/link";
import { Award, Clock, Lock } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { Badge, Card } from "@/components/ui/surface";
import { formatDuration, formatRelative } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import { coverUrl } from "@/lib/media";
import type { LearnerCourse } from "@/server/queries/learning";

/** Neutral, typographic cover used when a course has no cover image. */
export function CoverFallback({ title, category }: { title: string; category?: string | null }) {
  return (
    <div className="relative flex h-full w-full items-end overflow-hidden bg-brand-700 p-4">
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div aria-hidden className="absolute -right-6 -top-6 size-28 rounded-full border-[14px] border-accent-500/40" />
      <span className="relative line-clamp-2 text-label font-medium uppercase tracking-wider text-brand-100">
        {category ?? title}
      </span>
    </div>
  );
}

export function CourseCover({ path, title, category, className }: {
  path: string | null;
  title: string;
  category?: string | null;
  className?: string;
}) {
  const url = coverUrl(path);
  return (
    <div className={className}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- public bucket URL, sized by CSS
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <CoverFallback title={title} category={category} />
      )}
    </div>
  );
}

export function CourseStatusBadge({ course }: { course: LearnerCourse }) {
  if (!course.has_access) return <Badge tone="neutral">Accès suspendu</Badge>;
  if (course.enrollment_status === "completed") return <Badge tone="success" dot>Terminée</Badge>;
  if (course.started_at) return <Badge tone="accent" dot>En cours</Badge>;
  return <Badge tone="brand">À commencer</Badge>;
}

export function LearnerCourseCard({ course }: { course: LearnerCourse }) {
  const ratio = course.mandatory_lessons ? course.completed_lessons / course.mandatory_lessons : 0;
  const href = `/espace/formations/${course.course_id}`;
  const completed = course.enrollment_status === "completed";

  return (
    <Card className="flex flex-col overflow-hidden">
      <Link href={href} className="block aspect-[16/7] overflow-hidden border-b border-line" tabIndex={-1} aria-hidden>
        <CourseCover path={course.cover_path} title={course.title} category={course.category} className="h-full" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CourseStatusBadge course={course} />
          {course.category ? <span className="text-caption text-ink-500">{course.category}</span> : null}
        </div>
        <h3 className="text-card font-semibold text-ink-900">
          <Link href={href} className="hover:underline">
            {course.title}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {formatDuration(course.estimated_minutes)}
          </span>
          <span>{COURSE_LEVELS[course.level]}</span>
        </p>

        <div className="mt-auto space-y-3 pt-5">
          <div>
            <div className="mb-1.5 flex justify-between text-caption text-ink-600">
              <span>
                Leçons : <span className="tabular font-medium text-ink-800">{course.completed_lessons}</span>/
                <span className="tabular">{course.mandatory_lessons}</span>
              </span>
              <span>
                Évaluations : <span className="tabular font-medium text-ink-800">{course.quizzes_passed}</span>/
                <span className="tabular">{course.quizzes_total}</span>
              </span>
            </div>
            <ProgressBar value={ratio} label={`Leçons terminées : ${Math.round(ratio * 100)} %`} size="sm" tone={completed ? "success" : "accent"} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-caption text-ink-500">
              {course.last_activity_at ? `Dernière activité ${formatRelative(course.last_activity_at)}` : "Pas encore commencée"}
            </span>
            {!course.has_access ? (
              <span className="inline-flex items-center gap-1 text-caption text-ink-500">
                <Lock className="size-3.5" aria-hidden /> Indisponible
              </span>
            ) : completed ? (
              <Link href="/espace/certificats" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <Award /> Certificat
              </Link>
            ) : (
              <Link
                href={course.resume_lesson_id ? `${href}/lecons/${course.resume_lesson_id}` : href}
                className={buttonClasses({ variant: "primary", size: "sm" })}
              >
                {course.started_at ? "Reprendre" : "Commencer"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
