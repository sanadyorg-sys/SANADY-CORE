import Link from "next/link";
import { Award, BookOpen, ClipboardCheck } from "lucide-react";
import { ActivityList } from "@/components/learning/activity-list";
import { Curriculum } from "@/components/learning/curriculum";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDate, formatDateTime, formatRelative, formatScore } from "@/lib/format";
import type { ActivityItem, AttemptListItem, CourseOutline, LearnerCourse } from "@/server/queries/learning";

export interface LearnerCourseDetail {
  summary: LearnerCourse;
  outline: CourseOutline | null;
  attempts: AttemptListItem[];
}

/**
 * Read-only progress of one learner, used by institutions (assignment
 * scoped by RLS) and by SANADY administrators. Lesson completion,
 * assessment results and certification are presented separately.
 */
export function LearnerProgress({
  courses,
  activity,
  attemptHref,
  emptyMessage,
}: {
  courses: LearnerCourseDetail[];
  activity: ActivityItem[];
  attemptHref: (attemptId: string) => string;
  emptyMessage: string;
}) {
  if (courses.length === 0) {
    return (
      <Card>
        <EmptyState icon={BookOpen} title="Aucune formation à afficher" description={emptyMessage} />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        {courses.map(({ summary: c, outline, attempts }) => {
          const ratio = c.mandatory_lessons ? c.completed_lessons / c.mandatory_lessons : 0;
          const submitted = attempts.filter((a) => a.status === "submitted");
          return (
            <Card key={c.course_id}>
              <CardHeader
                title={c.title}
                description={`Inscrit(e) le ${formatDate(c.enrolled_at)} · dernière activité : ${c.last_activity_at ? formatRelative(c.last_activity_at) : "aucune"}`}
                actions={
                  c.enrollment_status === "completed" ? (
                    <Badge tone="success" dot>Terminée</Badge>
                  ) : c.started_at ? (
                    <Badge tone="teal" dot>En cours</Badge>
                  ) : (
                    <Badge>Non commencée</Badge>
                  )
                }
              />
              <CardBody className="space-y-6">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-md border border-line p-3">
                    <dt className="flex items-center gap-1.5 text-caption font-medium text-ink-500">
                      <BookOpen className="size-3.5" aria-hidden /> Leçons obligatoires
                    </dt>
                    <dd className="tabular mt-1 text-section font-semibold text-ink-900">
                      {c.completed_lessons}/{c.mandatory_lessons}
                    </dd>
                    <ProgressBar value={ratio} label="Leçons terminées" size="sm" className="mt-2" />
                  </div>
                  <div className="rounded-md border border-line p-3">
                    <dt className="flex items-center gap-1.5 text-caption font-medium text-ink-500">
                      <ClipboardCheck className="size-3.5" aria-hidden /> Évaluations réussies
                    </dt>
                    <dd className="tabular mt-1 text-section font-semibold text-ink-900">
                      {c.quizzes_passed}/{c.quizzes_total}
                    </dd>
                  </div>
                  <div className="rounded-md border border-line p-3">
                    <dt className="flex items-center gap-1.5 text-caption font-medium text-ink-500">
                      <Award className="size-3.5" aria-hidden /> Certificat
                    </dt>
                    <dd className="mt-1 text-body font-semibold text-ink-900">
                      {c.certificate_number ? <span className="font-mono text-label">{c.certificate_number}</span> : "Non délivré"}
                    </dd>
                  </div>
                </dl>

                {outline ? (
                  <div>
                    <h3 className="mb-2 text-label font-semibold uppercase tracking-wide text-ink-500">Programme</h3>
                    <Curriculum courseId={c.course_id} modules={outline.modules} interactive={false} />
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-2 text-label font-semibold uppercase tracking-wide text-ink-500">Résultats aux évaluations</h3>
                  {submitted.length === 0 ? (
                    <p className="text-body text-ink-500">Aucune évaluation soumise.</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-line">
                      <Table caption={`Évaluations — ${c.title}`}>
                        <THead>
                          <tr>
                            <TH>Module</TH>
                            <TH>Tentative</TH>
                            <TH>Date</TH>
                            <TH align="right">Score</TH>
                            <TH>Résultat</TH>
                            <TH align="right">
                              <span className="sr-only">Détail</span>
                            </TH>
                          </tr>
                        </THead>
                        <TBody>
                          {submitted.map((a) => (
                            <TR key={a.id}>
                              <TD>{a.quiz?.module?.title ?? a.quiz?.title}</TD>
                              <TD>
                                n° {a.attempt_number}
                                {a.voided_at ? <span className="block text-caption text-ink-500">Réinitialisée</span> : null}
                              </TD>
                              <TD className="whitespace-nowrap">{formatDateTime(a.submitted_at)}</TD>
                              <TD align="right">{formatScore(a.score_percent)}</TD>
                              <TD>{a.passed ? <Badge tone="success">Réussie</Badge> : <Badge tone="danger">Non validée</Badge>}</TD>
                              <TD align="right">
                                <Link href={attemptHref(a.id)} className="text-label font-medium text-teal-700 hover:underline">
                                  Détail
                                </Link>
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="self-start">
        <CardHeader title="Activité d’apprentissage" />
        <CardBody>
          {activity.length ? <ActivityList items={activity} /> : <p className="text-body text-ink-500">Aucune activité enregistrée.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
