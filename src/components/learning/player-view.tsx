import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, Download, FileText, PlayCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { Alert, Badge } from "@/components/ui/surface";
import { formatBytes } from "@/lib/media";
import type { PlayerData } from "@/server/queries/player";
import { Curriculum } from "./curriculum";
import { CurriculumDrawer } from "./curriculum-drawer";
import { LessonExperience } from "./lesson-experience";

/**
 * Course player layout.
 * Desktop: content + sticky curriculum panel. Tablet/mobile: content first,
 * curriculum available in a drawer — learning content is never squeezed.
 */
export function PlayerView({
  data,
  courseId,
  basePath,
  backHref,
  backLabel,
  preview = false,
}: {
  data: PlayerData;
  courseId: string;
  basePath: string;
  backHref: string;
  backLabel: string;
  preview?: boolean;
}) {
  const { lesson, outline, state } = data;
  const { totals } = outline;
  const ratio = totals.mandatory ? totals.completed / totals.mandatory : 0;
  const completed = state.status === "completed" && !preview;

  const summary = (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-label font-semibold text-ink-900">{outline.course.title}</p>
      <div className="mt-3">
        <ProgressBar value={ratio} label="Progression des leçons obligatoires" size="sm" showValue />
      </div>
      <p className="mt-2 text-caption text-ink-500">
        {totals.completed}/{totals.mandatory} leçons · {totals.quizzesPassed}/{totals.quizzes} évaluations réussies
      </p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Fil d’Ariane" className="min-w-0 text-label text-ink-500">
            <Link href={backHref} className="inline-flex items-center gap-1.5 font-medium text-ink-600 hover:text-ink-900">
              <ArrowLeft className="size-4" aria-hidden /> {backLabel}
            </Link>
            {data.moduleTitle ? <span className="ml-2 hidden truncate sm:inline">· {data.moduleTitle}</span> : null}
          </nav>
          <CurriculumDrawer
            courseId={courseId}
            modules={outline.modules}
            currentLessonId={lesson.id}
            basePath={basePath}
            summary={summary}
          />
        </div>

        {preview ? (
          <Alert tone="info" className="mb-4">
            Mode aperçu : vous voyez la leçon telle qu’un enseignant la verra. Aucune progression n’est enregistrée.
          </Alert>
        ) : null}

        <LessonExperience
          lessonId={lesson.id}
          media={data.media}
          resumePosition={state.resume_position}
          watchedBuckets={state.watched_buckets}
          pagesViewed={state.pages_viewed}
          completionThreshold={data.threshold}
          preview={preview}
        />

        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge tone="navy">
                {lesson.kind === "video" ? <PlayCircle className="size-3" aria-hidden /> : <FileText className="size-3" aria-hidden />}
                {lesson.kind === "video" ? "Vidéo" : "Document"}
              </Badge>
              {!lesson.is_mandatory ? <Badge>Facultative</Badge> : null}
              {completed ? (
                <Badge tone="success">
                  <CircleCheck className="size-3" aria-hidden /> Terminée
                </Badge>
              ) : null}
            </div>
            <h1 className="text-title font-semibold text-ink-900">{lesson.title}</h1>
          </div>
        </div>

        {lesson.description ? (
          <div className="mt-4 max-w-3xl whitespace-pre-line text-reading text-ink-700">{lesson.description}</div>
        ) : null}

        {data.resources.length ? (
          <section className="mt-8">
            <h2 className="mb-3 text-section font-semibold text-ink-900">Ressources complémentaires</h2>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {data.resources.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="size-4 shrink-0 text-ink-400" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-body text-ink-800">{r.title}</span>
                  {r.size_bytes ? <span className="hidden text-caption text-ink-500 sm:inline">{formatBytes(r.size_bytes)}</span> : null}
                  {r.url ? (
                    <a href={r.url} className={buttonClasses({ variant: "secondary", size: "sm" })} download>
                      <Download aria-hidden /> Télécharger
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav aria-label="Navigation entre les leçons" className="mt-10 grid grid-cols-1 gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {data.previous ? (
            <Link href={data.previous.href} className="group rounded-lg border border-line bg-surface px-4 py-3 hover:border-line-strong hover:bg-ink-25">
              <span className="flex items-center gap-1.5 text-caption text-ink-500">
                <ArrowLeft className="size-3.5" aria-hidden /> Précédent
              </span>
              <span className="mt-0.5 block truncate text-body font-medium text-ink-800">{data.previous.label}</span>
            </Link>
          ) : (
            <span />
          )}
          {data.next ? (
            <Link
              href={data.next.href}
              className="group rounded-lg border border-line bg-surface px-4 py-3 text-right hover:border-line-strong hover:bg-ink-25"
            >
              <span className="flex items-center justify-end gap-1.5 text-caption text-ink-500">
                Suivant <ArrowRight className="size-3.5" aria-hidden />
              </span>
              <span className="mt-0.5 block truncate text-body font-medium text-ink-800">{data.next.label}</span>
            </Link>
          ) : null}
        </nav>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] space-y-4 overflow-y-auto pb-4">
          {summary}
          <Curriculum courseId={courseId} modules={outline.modules} currentLessonId={lesson.id} basePath={basePath} />
        </div>
      </aside>
    </div>
  );
}
