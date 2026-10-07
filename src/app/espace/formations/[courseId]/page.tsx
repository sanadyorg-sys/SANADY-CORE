import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, BookOpen, CircleCheck, ClipboardCheck, Clock, Lock, Target } from "lucide-react";
import { ActivityList } from "@/components/learning/activity-list";
import { CourseCover } from "@/components/learning/course-card";
import { Curriculum } from "@/components/learning/curriculum";
import { buttonClasses } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { formatDate, formatDuration } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth";
import { getCourseOutline, getLearnerCourses, getRecentActivity } from "@/server/queries/learning";

export async function generateMetadata(props: PageProps<"/espace/formations/[courseId]">): Promise<Metadata> {
  const { courseId } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("title").eq("id", courseId).maybeSingle();
  return { title: (data as { title: string } | null)?.title ?? "Formation" };
}

export default async function CourseOverviewPage(props: PageProps<"/espace/formations/[courseId]">) {
  const { courseId } = await props.params;
  const viewer = await requireViewer();

  const enrollment = (await getLearnerCourses()).find((c) => c.course_id === courseId);
  if (!enrollment) notFound();

  if (!enrollment.has_access) {
    return (
      <>
        <BackLink />
        <h1 className="text-title font-semibold text-ink-900">{enrollment.title}</h1>
        <Alert tone="warning" title="Formation momentanément indisponible" className="mt-6 max-w-2xl">
          L’accès à cette formation a été suspendu (formation dépubliée, autorisation retirée ou fin d’affiliation à votre
          établissement). Votre progression est conservée.
          {enrollment.certificate_id ? (
            <>
              {" "}
              Votre certificat reste disponible dans <Link href="/espace/certificats">Mes certificats</Link>.
            </>
          ) : null}
        </Alert>
      </>
    );
  }

  let outline = await getCourseOutline(courseId, viewer.id);
  if (!outline) notFound();

  // Self-heal completion if the curriculum changed after the learner finished.
  const { totals } = outline;
  if (!enrollment.certificate_id && totals.mandatory > 0 && totals.completed === totals.mandatory && totals.quizzesPassed === totals.quizzes && totals.quizzes > 0) {
    const supabase = await createClient();
    const { data: issued } = await supabase.rpc("refresh_course_completion", { p_course: courseId });
    if (issued) outline = (await getCourseOutline(courseId, viewer.id)) ?? outline;
  }

  const activity = await getRecentActivity(viewer.id, { courseId, limit: 6 });
  const { course } = outline;
  const lessonRatio = totals.mandatory ? totals.completed / totals.mandatory : 0;
  const completed = enrollment.enrollment_status === "completed";
  const resumeHref = enrollment.resume_lesson_id
    ? `/espace/formations/${courseId}/lecons/${enrollment.resume_lesson_id}`
    : null;
  const pendingQuiz = outline.modules.map((m) => m.quiz).find((q) => q && !q.passed && q.unlocked && !q.exhausted);

  return (
    <>
      <BackLink />
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <header>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {course.category ? <Badge tone="navy">{course.category}</Badge> : null}
              <Badge>{COURSE_LEVELS[course.level]}</Badge>
              {completed ? <Badge tone="success" dot>Terminée</Badge> : null}
            </div>
            <h1 className="text-display font-semibold text-ink-900">{course.title}</h1>
            {course.summary ? <p className="mt-2 max-w-3xl text-reading text-ink-600">{course.summary}</p> : null}
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-label text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden /> {formatDuration(course.estimated_minutes)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4" aria-hidden /> {outline.modules.length} module{outline.modules.length > 1 ? "s" : ""}
              </span>
              {course.target_audience ? <span>Public : {course.target_audience}</span> : null}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {completed ? (
                <Link href="/espace/certificats" className={buttonClasses({ size: "lg" })}>
                  <Award aria-hidden /> Voir mon certificat
                </Link>
              ) : resumeHref ? (
                <Link href={resumeHref} className={buttonClasses({ size: "lg" })}>
                  {enrollment.started_at ? "Reprendre ma formation" : "Commencer la formation"} <ArrowRight aria-hidden />
                </Link>
              ) : pendingQuiz ? (
                <Link href={`/espace/formations/${courseId}/evaluations/${pendingQuiz.id}`} className={buttonClasses({ size: "lg" })}>
                  Passer l’évaluation <ArrowRight aria-hidden />
                </Link>
              ) : null}
            </div>
          </header>

          <section aria-labelledby="mesures" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <h2 id="mesures" className="sr-only">
              Ma progression
            </h2>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-label font-medium text-ink-600">
                <BookOpen className="size-4 text-ink-400" aria-hidden /> Leçons obligatoires
              </p>
              <p className="tabular mt-2 text-stat font-semibold text-ink-900">
                {totals.completed}
                <span className="text-section font-normal text-ink-400">/{totals.mandatory}</span>
              </p>
              <ProgressBar value={lessonRatio} label="Leçons obligatoires terminées" size="sm" className="mt-3" />
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-label font-medium text-ink-600">
                <ClipboardCheck className="size-4 text-ink-400" aria-hidden /> Évaluations réussies
              </p>
              <p className="tabular mt-2 text-stat font-semibold text-ink-900">
                {totals.quizzesPassed}
                <span className="text-section font-normal text-ink-400">/{totals.quizzes}</span>
              </p>
              <p className="mt-2 text-caption text-ink-500">Seuil de réussite : 70 % · 3 tentatives par évaluation</p>
            </Card>
            <Card className="p-5">
              <p className="flex items-center gap-2 text-label font-medium text-ink-600">
                <Award className="size-4 text-ink-400" aria-hidden /> Certificat
              </p>
              {enrollment.certificate_number ? (
                <>
                  <p className="mt-2 flex items-center gap-2 text-card font-semibold text-success-700">
                    <CircleCheck className="size-5" aria-hidden /> Obtenu
                  </p>
                  <p className="mt-2 font-mono text-caption text-ink-500">{enrollment.certificate_number}</p>
                </>
              ) : (
                <>
                  <p className="mt-2 flex items-center gap-2 text-card font-semibold text-ink-700">
                    <Lock className="size-4 text-ink-400" aria-hidden /> Non encore obtenu
                  </p>
                  <p className="mt-2 text-caption text-ink-500">Délivré automatiquement à la fin de la formation.</p>
                </>
              )}
            </Card>
          </section>

          {course.objectives.length ? (
            <section>
              <h2 className="mb-3 text-section font-semibold text-ink-900">Objectifs de la formation</h2>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 md:grid-cols-2">
                {course.objectives.map((o, i) => (
                  <li key={i} className="flex gap-3 text-body text-ink-700">
                    <Target className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
                    {o}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-section font-semibold text-ink-900">Programme</h2>
            <Curriculum courseId={courseId} modules={outline.modules} />
          </section>

          {course.description ? (
            <section>
              <h2 className="mb-3 text-section font-semibold text-ink-900">Présentation</h2>
              <div className="max-w-3xl whitespace-pre-line text-reading text-ink-700">{course.description}</div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card className="overflow-hidden">
            <CourseCover path={course.cover_path} title={course.title} category={course.category} className="aspect-[16/9]" />
            <CardBody className="space-y-2 text-label text-ink-600">
              <p>Inscrit(e) le {formatDate(enrollment.enrolled_at)}</p>
              {enrollment.completed_at ? <p>Terminée le {formatDate(enrollment.completed_at)}</p> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Activité dans cette formation" />
            <CardBody>
              {activity.length ? (
                <ActivityList items={activity} showCourse={false} />
              ) : (
                <p className="text-body text-ink-500">Aucune activité pour le moment.</p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link href="/espace/formations" className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
      <ArrowLeft className="size-4" aria-hidden /> Mes formations
    </Link>
  );
}
