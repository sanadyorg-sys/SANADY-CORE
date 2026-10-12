import Link from "next/link";
import { ArrowRight, Award, Clock, Layers, PlayCircle } from "lucide-react";
import { CourseCover } from "@/components/learning/course-card";
import { formatDuration, plural } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import type { CatalogCourse } from "@/server/queries/public";

/** Public catalog card: the whole card is one link to the course page. */
export function CatalogCard({ course }: { course: CatalogCourse }) {
  return (
    <article className="group card-shine glow-card relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition duration-300 hover:-translate-y-1 hover:border-accent-500/40 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-line bg-ink-100">
        <CourseCover
          path={course.cover_path}
          title={course.title}
          category={course.category}
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
        />
        {/* Duration on the image (Edraak-style). */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-900/80 px-2.5 py-0.5 text-caption font-semibold text-white backdrop-blur-sm">
          <Clock className="size-3.5" aria-hidden /> {formatDuration(course.estimated_minutes)}
        </span>
        {course.category ? (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-line/50 bg-surface/90 px-2.5 py-0.5 text-caption font-semibold tracking-wide text-accent-800 shadow-xs backdrop-blur-sm">
            {course.category}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-section font-bold tracking-tight text-ink-900 transition-colors group-hover:text-accent-700">
          <Link href={`/formations/${course.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {course.title}
          </Link>
        </h3>
        {course.summary ? <p className="mt-2 line-clamp-2 text-body leading-relaxed text-ink-600">{course.summary}</p> : null}
        <ul className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-4 text-caption text-ink-600">
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
          <span className="rounded-md bg-ink-50 px-2 py-0.5 font-medium text-ink-700">{COURSE_LEVELS[course.level]}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-success-700">
            <Award className="size-3.5" aria-hidden /> Certificat inclus
            <ArrowRight className="size-3.5 -translate-x-1 text-accent-700 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}
