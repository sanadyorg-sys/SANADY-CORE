import Link from "next/link";
import { Award, Clock, Layers, PlayCircle } from "lucide-react";
import { CourseCover } from "@/components/learning/course-card";
import { formatDuration, plural } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import type { CatalogCourse } from "@/server/queries/public";

/** Public catalog card: the whole card is one link to the course page. */
export function CatalogCard({ course }: { course: CatalogCourse }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md">
      <div className="aspect-[16/9] overflow-hidden border-b border-line">
        <CourseCover
          path={course.cover_path}
          title={course.title}
          category={course.category}
          className="h-full transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        {course.category ? (
          <p className="text-caption font-semibold uppercase tracking-wider text-accent-700">{course.category}</p>
        ) : null}
        <h3 className="mt-1.5 text-section font-semibold text-ink-900">
          <Link href={`/formations/${course.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {course.title}
          </Link>
        </h3>
        {course.summary ? <p className="mt-2 line-clamp-2 text-body text-ink-600">{course.summary}</p> : null}
        <ul className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-4 text-caption text-ink-600">
          <li className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-ink-400" aria-hidden /> {formatDuration(course.estimated_minutes)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5 text-ink-400" aria-hidden /> {plural(course.module_count, "module")}
          </li>
          {course.video_count ? (
            <li className="inline-flex items-center gap-1.5">
              <PlayCircle className="size-3.5 text-ink-400" aria-hidden /> {plural(course.video_count, "vidéo")}
            </li>
          ) : null}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-caption">
          <span className="font-medium text-ink-700">{COURSE_LEVELS[course.level]}</span>
          <span className="inline-flex items-center gap-1 font-medium text-success-700">
            <Award className="size-3.5" aria-hidden /> Certificat inclus
          </span>
        </div>
      </div>
    </article>
  );
}
