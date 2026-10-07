import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, CircleCheck, ClipboardCheck, Inbox } from "lucide-react";
import { ActivityList } from "@/components/learning/activity-list";
import { CourseCover, LearnerCourseCard } from "@/components/learning/course-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Card, CardBody, CardHeader, SectionHeading, StatTile } from "@/components/ui/surface";
import { formatDate, formatDuration, formatRelative } from "@/lib/format";
import { requireViewer } from "@/server/auth";
import { getCertificates, getLearnerCourses, getRecentActivity } from "@/server/queries/learning";

export const metadata: Metadata = { title: "Tableau de bord" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Africa/Casablanca" }).format(new Date()));
  return hour >= 18 || hour < 4 ? "Bonsoir" : "Bonjour";
}

export default async function TeacherDashboardPage() {
  const viewer = await requireViewer();
  const [courses, activity, certificates] = await Promise.all([
    getLearnerCourses(),
    getRecentActivity(viewer.id, { limit: 6 }),
    getCertificates(viewer.id),
  ]);

  const accessible = courses.filter((c) => c.has_access);
  const active = accessible.filter((c) => c.enrollment_status === "active");
  const completed = courses.filter((c) => c.enrollment_status === "completed");
  const resume = active.find((c) => c.started_at) ?? active[0];
  const quizzesPassed = courses.reduce((sum, c) => sum + c.quizzes_passed, 0);
  const validCertificates = certificates.filter((c) => !c.revoked_at);

  return (
    <>
      <header className="mb-8">
        <p className="text-label text-ink-500">{formatDate(new Date())}</p>
        <h1 className="mt-1 text-title font-semibold text-ink-900">
          {greeting()}, {viewer.profile.first_name || "et bienvenue"}
        </h1>
      </header>

      {courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title="Aucune formation ne vous est encore attribuée"
            description="Les formations vous sont attribuées par l’équipe SANADY ou par votre établissement. Elles apparaîtront ici dès leur affectation."
            action={
              <Link href="/rejoindre" className={buttonClasses({ variant: "secondary" })}>
                J’ai un code d’établissement
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {resume ? <ResumeCard course={resume} /> : null}

          <section aria-label="Synthèse" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile label="Formations en cours" value={active.length} icon={BookOpen} />
            <StatTile label="Formations terminées" value={completed.length} icon={CircleCheck} />
            <StatTile label="Évaluations réussies" value={quizzesPassed} icon={ClipboardCheck} />
            <StatTile label="Certificats obtenus" value={validCertificates.length} icon={Award} />
          </section>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section>
              <SectionHeading
                title="Mes formations en cours"
                actions={
                  <Link href="/espace/formations" className="inline-flex items-center gap-1 text-label font-medium text-accent-700 hover:underline">
                    Toutes mes formations <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                }
              />
              {active.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {active.slice(0, 4).map((c) => (
                    <LearnerCourseCard key={c.course_id} course={c} />
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    compact
                    icon={CircleCheck}
                    title="Toutes vos formations sont terminées"
                    description="Retrouvez vos certificats dans la rubrique dédiée."
                  />
                </Card>
              )}
            </section>

            <aside className="space-y-6">
              <Card>
                <CardHeader title="Activité récente" />
                <CardBody>
                  {activity.length ? (
                    <ActivityList items={activity} />
                  ) : (
                    <p className="text-body text-ink-500">Votre activité d’apprentissage apparaîtra ici.</p>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Mes certificats"
                  actions={
                    validCertificates.length ? (
                      <Link href="/espace/certificats" className="text-label font-medium text-accent-700 hover:underline">
                        Voir tout
                      </Link>
                    ) : null
                  }
                />
                <CardBody>
                  {validCertificates.length ? (
                    <ul className="space-y-3">
                      {validCertificates.slice(0, 3).map((c) => (
                        <li key={c.id} className="flex items-start gap-3">
                          <Award className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate text-body font-medium text-ink-800">{c.course_title}</p>
                            <p className="text-caption text-ink-500">Délivré le {formatDate(c.issued_at)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-body text-ink-500">
                      Un certificat est délivré automatiquement lorsque toutes les leçons obligatoires sont terminées et toutes les
                      évaluations réussies.
                    </p>
                  )}
                </CardBody>
              </Card>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}

function ResumeCard({ course }: { course: Awaited<ReturnType<typeof getLearnerCourses>>[number] }) {
  const ratio = course.mandatory_lessons ? course.completed_lessons / course.mandatory_lessons : 0;
  const href = course.resume_lesson_id
    ? `/espace/formations/${course.course_id}/lecons/${course.resume_lesson_id}`
    : `/espace/formations/${course.course_id}`;
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
        <CourseCover path={course.cover_path} title={course.title} category={course.category} className="hidden h-full min-h-[160px] md:block" />
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-label font-medium text-accent-700">{course.started_at ? "Reprendre ma formation" : "Commencer ma formation"}</p>
            <h2 className="mt-1 text-section font-semibold text-ink-900">{course.title}</h2>
            <p className="mt-1 text-label text-ink-500">
              {formatDuration(course.estimated_minutes)}
              {course.last_activity_at ? ` · Dernière activité ${formatRelative(course.last_activity_at)}` : ""}
            </p>
            <div className="mt-4 max-w-md">
              <ProgressBar value={ratio} label="Progression des leçons" showValue />
              <p className="mt-1.5 text-caption text-ink-500">
                {course.completed_lessons} leçon{course.completed_lessons > 1 ? "s" : ""} terminée{course.completed_lessons > 1 ? "s" : ""} sur{" "}
                {course.mandatory_lessons} · {course.quizzes_passed}/{course.quizzes_total} évaluation
                {course.quizzes_total > 1 ? "s" : ""} réussie{course.quizzes_passed > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Link href={href} className={buttonClasses({ size: "lg", className: "shrink-0" })}>
            {course.started_at ? "Reprendre" : "Commencer"} <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>
    </Card>
  );
}
