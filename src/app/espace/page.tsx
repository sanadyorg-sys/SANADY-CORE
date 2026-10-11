import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Inbox,
  Lock,
  PlayCircle,
} from "lucide-react";
import { ActivityList } from "@/components/learning/activity-list";
import { CourseCover, LearnerCourseCard } from "@/components/learning/course-card";
import { KIND_ICONS } from "@/components/library/library-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Badge, Card, CardBody, CardHeader, SectionHeading, StatTile } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatDate, formatRelative, formatScore } from "@/lib/format";
import { LIBRARY_KINDS } from "@/lib/labels";
import { todayInMorocco } from "@/lib/period";
import { requireViewer } from "@/server/auth";
import {
  getAttempts,
  getCertificates,
  getLearnerCourses,
  getNextSteps,
  getRecentActivity,
  type LearnerCourse,
  type NextStep,
} from "@/server/queries/learning";
import { libraryHighlights } from "@/server/queries/library";

export const metadata: Metadata = { title: "Tableau de bord" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Africa/Casablanca" }).format(new Date()));
  return hour >= 18 || hour < 4 ? "Bonsoir" : "Bonjour";
}

const DAY = 86_400_000;

/** Days until a due date (negative when overdue), in Morocco's calendar. */
function daysUntil(due: string, today: string) {
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

function DueBadge({ due, today }: { due: string; today: string }) {
  const days = daysUntil(due, today);
  if (days < 0) return <Badge tone="danger">Échéance dépassée ({formatDate(due)})</Badge>;
  if (days <= 7) return <Badge tone="warning">À terminer avant le {formatDate(due)}</Badge>;
  return <Badge tone="neutral">Échéance : {formatDate(due)}</Badge>;
}

function stepHref(step: NextStep) {
  const base = `/espace/formations/${step.course_id}`;
  if (step.step_kind === "lesson" && step.lesson_id) return `${base}/lecons/${step.lesson_id}`;
  if (step.quiz_id) return `${base}/evaluations/${step.quiz_id}`;
  return base;
}

const STEP_LABEL: Record<NextStep["step_kind"], string> = {
  lesson: "Leçon suivante",
  quiz: "Évaluation disponible",
  blocked: "Évaluation à débloquer",
};

export default async function TeacherDashboardPage() {
  const viewer = await requireViewer();
  const [courses, steps, activity, certificates, attempts] = await Promise.all([
    getLearnerCourses(),
    getNextSteps(),
    getRecentActivity(viewer.id, { limit: 6 }),
    getCertificates(viewer.id),
    getAttempts(viewer.id),
  ]);
  const library = await libraryHighlights(courses.map((c) => c.course_id));
  const today = todayInMorocco();

  const accessible = courses.filter((c) => c.has_access);
  const active = accessible.filter((c) => c.enrollment_status === "active");
  const completed = courses.filter((c) => c.enrollment_status === "completed");
  const quizzesPassed = courses.reduce((sum, c) => sum + c.quizzes_passed, 0);
  const validCertificates = certificates.filter((c) => !c.revoked_at);
  const recentResults = attempts.filter((a) => a.status === "submitted" && !a.voided_at).slice(0, 3);
  const lessonsDone = active.reduce((s, c) => s + c.completed_lessons, 0);
  const lessonsTotal = active.reduce((s, c) => s + c.mandatory_lessons, 0);
  const coursesById = new Map(courses.map((c) => [c.course_id, c]));
  const [next, ...later] = steps;

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label text-ink-500">{formatDate(new Date())}</p>
          <h1 className="mt-1 text-title font-semibold text-ink-900">
            {greeting()}, {viewer.profile.first_name || "et bienvenue"}
          </h1>
        </div>
        {lessonsTotal > 0 ? (
          <div className="w-full max-w-xs">
            <p className="mb-1.5 text-label text-ink-600">
              Leçons obligatoires terminées :{" "}
              <span className="tabular font-semibold text-ink-900">
                {lessonsDone}/{lessonsTotal}
              </span>
            </p>
            <ProgressBar value={lessonsDone / lessonsTotal} label="Progression globale des leçons obligatoires" showValue />
          </div>
        ) : null}
      </header>

      {courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title="Aucune formation ne vous est encore attribuée"
            description="Les formations vous sont attribuées par l’équipe SANADY ou par votre établissement. Elles apparaîtront ici dès leur affectation."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/rejoindre" className={buttonClasses({ variant: "secondary" })}>
                  J’ai un code d’établissement
                </Link>
                <Link href="/espace/bibliotheque" className={buttonClasses({ variant: "ghost" })}>
                  Explorer la bibliothèque
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {next ? (
            <NextStepCard step={next} course={coursesById.get(next.course_id)} today={today} />
          ) : active.length === 0 ? null : (
            <Card>
              <EmptyState compact icon={CircleCheck} title="Rien d’urgent" description="Vos formations en cours sont à jour." />
            </Card>
          )}

          <section aria-label="Synthèse" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile label="Formations en cours" value={active.length} icon={BookOpen} />
            <StatTile label="Formations terminées" value={completed.length} icon={CircleCheck} />
            <StatTile label="Évaluations réussies" value={quizzesPassed} icon={ClipboardCheck} />
            <StatTile label="Certificats obtenus" value={validCertificates.length} icon={Award} />
          </section>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-8">
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

              <section>
                <SectionHeading title="Historique d’apprentissage" />
                <Card>
                  <CardBody>
                    {activity.length ? (
                      <ActivityList items={activity} />
                    ) : (
                      <p className="text-body text-ink-500">Votre activité d’apprentissage apparaîtra ici.</p>
                    )}
                  </CardBody>
                </Card>
              </section>
            </div>

            <aside className="space-y-6">
              {later.length ? (
                <Card>
                  <CardHeader title="Ensuite" description="La prochaine étape de vos autres formations" />
                  <CardBody>
                    <ul className="space-y-4">
                      {later.slice(0, 4).map((s) => (
                        <li key={s.course_id}>
                          <Link href={stepHref(s)} className="group block">
                            <p className="text-caption font-medium text-ink-500">{s.course_title}</p>
                            <p className="text-body font-medium text-ink-900 group-hover:underline">{s.item_title}</p>
                          </Link>
                          {s.due_on ? (
                            <div className="mt-1">
                              <DueBadge due={s.due_on} today={today} />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              ) : null}

              <Card>
                <CardHeader
                  title="Dernières évaluations"
                  actions={
                    recentResults.length ? (
                      <Link href="/espace/evaluations" className="text-label font-medium text-accent-700 hover:underline">
                        Voir tout
                      </Link>
                    ) : null
                  }
                />
                <CardBody>
                  {recentResults.length ? (
                    <ul className="space-y-3">
                      {recentResults.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/espace/formations/${a.course_id}/evaluations/${a.quiz_id}/resultats/${a.id}`}
                            className="flex items-start justify-between gap-3 rounded-md hover:bg-ink-25"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-body font-medium text-ink-800">{a.quiz?.title}</span>
                              <span className="block text-caption text-ink-500">
                                Tentative {a.attempt_number} · {formatRelative(a.submitted_at)}
                              </span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="tabular block text-body font-semibold text-ink-900">{formatScore(a.score_percent)}</span>
                              <Badge tone={a.passed ? "success" : "neutral"}>{a.passed ? "Réussie" : "Non validée"}</Badge>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-body text-ink-500">Chaque module se termine par une évaluation : 70 % pour la valider, trois tentatives.</p>
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

              {library.length ? (
                <Card>
                  <CardHeader
                    title="Bibliothèque pédagogique"
                    actions={
                      <Link href="/espace/bibliotheque" className="text-label font-medium text-accent-700 hover:underline">
                        Explorer
                      </Link>
                    }
                  />
                  <CardBody>
                    <ul className="space-y-3">
                      {library.map((r) => {
                        const Icon = KIND_ICONS[r.kind] ?? BookMarked;
                        return (
                          <li key={r.id}>
                            <Link href={`/espace/bibliotheque/${r.id}`} className="group flex items-start gap-3">
                              <Icon className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden />
                              <span className="min-w-0">
                                <span className="block text-body font-medium text-ink-800 group-hover:underline">{r.title}</span>
                                <span className="block text-caption text-ink-500">
                                  {LIBRARY_KINDS[r.kind]}
                                  {r.course ? ` · ${r.course.title}` : ""}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </CardBody>
                </Card>
              ) : null}
            </aside>
          </div>
        </div>
      )}
    </>
  );
}

function NextStepCard({ step, course, today }: { step: NextStep; course?: LearnerCourse; today: string }) {
  const href = stepHref(step);
  const Icon = step.step_kind === "lesson" ? PlayCircle : step.step_kind === "quiz" ? ClipboardCheck : Lock;
  const ratio = course && course.mandatory_lessons ? course.completed_lessons / course.mandatory_lessons : 0;
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
        <CourseCover path={course?.cover_path ?? null} title={step.course_title} category={course?.category} className="hidden h-full min-h-[180px] md:block" imageClassName="object-left" />
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-label font-semibold uppercase tracking-wider text-accent-700">Ma prochaine étape</p>
            <h2 className="mt-1 text-section font-semibold text-ink-900">{step.course_title}</h2>
            <p className="mt-3 flex items-start gap-2 text-body text-ink-800">
              <Icon className={cn("mt-0.5 size-4 shrink-0", step.step_kind === "blocked" ? "text-ink-500" : "text-accent-600")} aria-hidden />
              <span>
                <span className="font-medium">{STEP_LABEL[step.step_kind]} :</span> {step.item_title}
                <span className="block text-caption text-ink-500">
                  Module {step.module_position} — {step.module_title}
                  {step.step_kind === "quiz" && step.attempts_used > 0
                    ? ` · ${step.max_attempts - step.attempts_used} tentative${step.max_attempts - step.attempts_used > 1 ? "s" : ""} restante${step.max_attempts - step.attempts_used > 1 ? "s" : ""}`
                    : ""}
                </span>
              </span>
            </p>
            {step.step_kind === "blocked" ? (
              <p className="mt-3 max-w-xl text-label text-ink-600">
                Vous avez utilisé vos {step.max_attempts} tentatives. Un administrateur SANADY peut les réinitialiser après un échange avec
                vous : revoyez les leçons du module en attendant.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {step.due_on ? <DueBadge due={step.due_on} today={today} /> : null}
              {course ? (
                <div className="w-full max-w-xs">
                  <ProgressBar value={ratio} label="Progression des leçons de cette formation" size="sm" showValue />
                </div>
              ) : null}
            </div>
          </div>
          <Link href={href} className={buttonClasses({ size: "lg", variant: step.step_kind === "blocked" ? "secondary" : "primary", className: "shrink-0" })}>
            {step.step_kind === "lesson" ? (
              <>
                {course?.started_at ? "Continuer" : "Commencer"} <ArrowRight aria-hidden />
              </>
            ) : step.step_kind === "quiz" ? (
              <>
                Passer l’évaluation <ArrowRight aria-hidden />
              </>
            ) : (
              <>
                <FileText aria-hidden /> Revoir la formation
              </>
            )}
          </Link>
        </div>
      </div>
    </Card>
  );
}

