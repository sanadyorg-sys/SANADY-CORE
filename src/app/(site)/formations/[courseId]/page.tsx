import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Award,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock,
  FileText,
  Infinity as InfinityIcon,
  Layers,
  MonitorSmartphone,
  PlayCircle,
  QrCode,
  Users,
} from "lucide-react";
import { CourseCover } from "@/components/learning/course-card";
import { CatalogCard } from "@/components/site/catalog-card";
import { buttonClasses } from "@/components/ui/button";
import { formatClock, formatDate, formatDuration, plural } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import { uuidSchema } from "@/lib/validation";
import { getViewer } from "@/server/auth";
import { getCatalog, getPublicCourse, type PublicCourse } from "@/server/queries/public";

async function load(courseId: string) {
  if (!uuidSchema.safeParse(courseId).success) return null;
  return getPublicCourse(courseId);
}

export async function generateMetadata({ params }: PageProps<"/formations/[courseId]">): Promise<Metadata> {
  const course = await load((await params).courseId);
  if (!course) return { title: "Formation introuvable" };
  return { title: course.title, description: course.summary || undefined };
}

function lessonMeta(l: PublicCourse["modules"][number]["lessons"][number]) {
  if (l.kind === "video" && l.video_duration_seconds) return formatClock(l.video_duration_seconds);
  if (l.kind === "pdf" && l.pdf_page_count) return `${l.pdf_page_count} p.`;
  return l.estimated_minutes ? formatDuration(l.estimated_minutes) : "";
}

export default async function PublicCoursePage({ params }: PageProps<"/formations/[courseId]">) {
  const { courseId } = await params;
  const [course, viewer, catalog] = await Promise.all([load(courseId), getViewer(), getCatalog()]);
  if (!course) notFound();

  const lessons = course.modules.flatMap((m) => m.lessons);
  const videos = lessons.filter((l) => l.kind === "video").length;
  const documents = lessons.filter((l) => l.kind === "pdf").length;
  const quizzes = course.modules.filter((m) => m.quiz).length;
  const firstQuiz = course.modules.find((m) => m.quiz)?.quiz;
  const related = catalog.courses.filter((c) => c.id !== course.id && c.category === course.category).slice(0, 3);
  const others = related.length ? related : catalog.courses.filter((c) => c.id !== course.id).slice(0, 3);
  const learnHref = `/espace/formations/${course.id}`;

  const includes = [
    videos ? { icon: PlayCircle, text: `${plural(videos, "vidéo")}` } : null,
    documents ? { icon: FileText, text: `${plural(documents, "document")} à lire` } : null,
    quizzes ? { icon: ClipboardCheck, text: `${plural(quizzes, "évaluation")} de module` } : null,
    { icon: Award, text: "Certificat de réussite" },
    { icon: MonitorSmartphone, text: "Ordinateur, tablette et téléphone" },
    { icon: InfinityIcon, text: "À votre rythme, sans limite de temps" },
  ].filter((x): x is { icon: typeof PlayCircle; text: string } => Boolean(x));

  const enrollBox = (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
      <CourseCover path={course.cover_path} title={course.title} category={course.category} className="aspect-[16/9] border-b border-line" />
      <div className="p-6">
        <p className="text-[1.75rem] font-extrabold tracking-tight text-ink-900">Gratuit</p>
        <p className="text-label text-ink-500">Offert par la Fondation Sanady</p>
        <div className="mt-5 flex flex-col gap-2">
          {viewer ? (
            <Link href={learnHref} className={buttonClasses({ variant: "brand", size: "xl" })}>
              Accéder à la formation <ArrowRight aria-hidden />
            </Link>
          ) : (
            <>
              <Link href={`/demande-acces?formation=${course.id}`} className={buttonClasses({ variant: "brand", size: "xl" })}>
                Demander un accès <ArrowRight aria-hidden />
              </Link>
              <Link href={`/connexion?suite=${encodeURIComponent(learnHref)}`} className={buttonClasses({ variant: "secondary", size: "lg" })}>
                Déjà inscrit ? Se connecter
              </Link>
            </>
          )}
        </div>
        <h2 className="mt-6 text-label font-semibold text-ink-900">Cette formation comprend</h2>
        <ul className="mt-3 space-y-2.5">
          {includes.map((i) => (
            <li key={i.text} className="flex items-center gap-2.5 text-body text-ink-700">
              <i.icon className="size-4 shrink-0 text-ink-500" aria-hidden /> {i.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      {/* ─── Header band ──────────────────────────────────────────────────── */}
      <section className="bg-brand-800 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-14">
          <div className="lg:pr-6">
            <nav aria-label="Fil d’Ariane" className="text-label text-brand-200">
              <Link href="/formations" className="hover:text-white hover:underline">
                Formations
              </Link>
              {course.category ? <> / <span className="text-brand-100">{course.category}</span></> : null}
            </nav>
            <h1 className="mt-4 text-[2rem] font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">{course.title}</h1>
            {course.summary ? <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-brand-100">{course.summary}</p> : null}
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-body text-brand-100">
              <li className="inline-flex items-center gap-2">
                <BarChart3 className="size-4 text-accent-500" aria-hidden /> {COURSE_LEVELS[course.level]}
              </li>
              <li className="inline-flex items-center gap-2">
                <Clock className="size-4 text-accent-500" aria-hidden /> {formatDuration(course.estimated_minutes)}
              </li>
              <li className="inline-flex items-center gap-2">
                <Layers className="size-4 text-accent-500" aria-hidden /> {plural(course.modules.length, "module")} ·{" "}
                {plural(lessons.length, "leçon")}
              </li>
              <li className="inline-flex items-center gap-2">
                <Award className="size-4 text-accent-500" aria-hidden /> Certificat vérifiable
              </li>
            </ul>
            <p className="mt-5 text-label text-brand-300">Mise à jour le {formatDate(course.updated_at)}</p>
          </div>
          <div className="lg:hidden">{enrollBox}</div>
          {/* Desktop: the box starts in the band and overflows into the empty right column below. */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-x-0 top-0 z-10">{enrollBox}</div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="min-w-0 space-y-12 lg:pr-6">
          {/* ─── Objectives ─────────────────────────────────────────────── */}
          {course.objectives.length ? (
            <section aria-labelledby="objectifs" className="rounded-xl border border-line p-6 sm:p-8">
              <h2 id="objectifs" className="text-[1.375rem] font-bold text-ink-900">
                Ce que vous allez apprendre
              </h2>
              <ul className="mt-5 grid gap-x-8 gap-y-3 md:grid-cols-2">
                {course.objectives.map((o) => (
                  <li key={o} className="flex items-start gap-3 text-body leading-relaxed text-ink-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden /> {o}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ─── Program ────────────────────────────────────────────────── */}
          <section aria-labelledby="programme">
            <h2 id="programme" className="text-[1.375rem] font-bold text-ink-900">
              Programme de la formation
            </h2>
            <p className="mt-1 text-body text-ink-600">
              {plural(course.modules.length, "module")} · {plural(lessons.length, "leçon")} ·{" "}
              {plural(quizzes, "évaluation")} · {formatDuration(course.estimated_minutes)}
            </p>
            <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {course.modules.map((m, mi) => (
                <details key={m.id} className="group" open={mi === 0}>
                  <summary className="flex cursor-pointer list-none items-center gap-4 bg-ink-25 px-5 py-4 hover:bg-ink-50">
                    <ChevronDown className="size-4 shrink-0 text-ink-500 transition-transform group-open:rotate-180" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-caption font-semibold uppercase tracking-wider text-ink-500">Module {mi + 1}</span>
                      <span className="block text-card font-semibold text-ink-900">{m.title}</span>
                    </span>
                    <span className="shrink-0 text-label text-ink-500">
                      {plural(m.lessons.length, "leçon")}
                    </span>
                  </summary>
                  <ul className="divide-y divide-line/70 bg-surface">
                    {m.description ? <li className="px-5 py-3 pl-13 text-body text-ink-600">{m.description}</li> : null}
                    {m.lessons.map((l, li) => (
                      <li key={li} className="flex items-center gap-3 px-5 py-3 pl-13 text-body">
                        {l.kind === "video" ? (
                          <PlayCircle className="size-4 shrink-0 text-ink-500" aria-label="Vidéo" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-ink-500" aria-label="Document" />
                        )}
                        <span className="min-w-0 flex-1 text-ink-800">
                          {l.title}
                          {!l.is_mandatory ? <span className="ml-2 text-caption text-ink-500">(facultative)</span> : null}
                        </span>
                        <span className="shrink-0 text-label tabular text-ink-500">{lessonMeta(l)}</span>
                      </li>
                    ))}
                    {m.quiz ? (
                      <li className="flex items-center gap-3 px-5 py-3 pl-13 text-body">
                        <ClipboardCheck className="size-4 shrink-0 text-accent-700" aria-label="Évaluation" />
                        <span className="min-w-0 flex-1 font-medium text-ink-800">{m.quiz.title}</span>
                        <span className="shrink-0 text-label text-ink-500">
                          {plural(m.quiz.question_count, "question")}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          {/* ─── Description ────────────────────────────────────────────── */}
          {course.description ? (
            <section aria-labelledby="description">
              <h2 id="description" className="text-[1.375rem] font-bold text-ink-900">
                Présentation
              </h2>
              <div className="mt-4 space-y-4 text-reading text-ink-700">
                {course.description.split(/\n{2,}/).map((p, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {course.trainers?.length ? (
            <section aria-labelledby="formateurs">
              <h2 id="formateurs" className="text-[1.375rem] font-bold text-ink-900">
                {course.trainers.length > 1 ? "Les formateurs" : "Le formateur"}
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {course.trainers.map((t, i) => (
                  <li key={i} className="flex items-center gap-4 rounded-xl border border-line p-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-50 text-card font-bold text-accent-800" aria-hidden>
                      {(t.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-card font-semibold text-ink-900">{t.name}</span>
                      {t.job_title ? <span className="block text-label text-ink-600">{t.job_title}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ─── Audience & certification ───────────────────────────────── */}
          <section className="grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-line p-6">
              <Users className="size-6 text-accent-700" aria-hidden />
              <h2 className="mt-3 text-section font-semibold text-ink-900">Public visé</h2>
              <p className="mt-2 text-body leading-relaxed text-ink-600">{course.target_audience || "Tous les enseignants."}</p>
            </div>
            <div className="rounded-xl border border-line p-6">
              <QrCode className="size-6 text-accent-700" aria-hidden />
              <h2 className="mt-3 text-section font-semibold text-ink-900">Certification</h2>
              <p className="mt-2 text-body leading-relaxed text-ink-600">
                Validez chaque module avec au moins {firstQuiz?.pass_threshold ?? 70}&nbsp;% de bonnes réponses ({firstQuiz?.max_attempts ?? 3}{" "}
                tentatives). Votre certificat est délivré automatiquement et{" "}
                <Link href="/verifier" className="font-medium text-accent-700 hover:underline">
                  vérifiable en ligne
                </Link>
                .
              </p>
            </div>
          </section>
        </div>

        <div aria-hidden className="hidden min-h-[30rem] lg:block" />
      </div>

      {/* ─── Related ──────────────────────────────────────────────────────── */}
      {others.length ? (
        <section className="border-t border-line bg-ink-25">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="text-[1.5rem] font-bold text-ink-900">{related.length ? "Dans le même thème" : "Autres formations"}</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((c) => (
                <CatalogCard key={c.id} course={c} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
