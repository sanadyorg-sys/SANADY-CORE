import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CircleCheck, Clock3, LifeBuoy, Mail, UserCheck, Users } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Badge, Card, CardBody, CardHeader, PageHeader, StatTile } from "@/components/ui/surface";
import { formatDateTime, formatRelative } from "@/lib/format";
import { EVENT_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { LearningEventType } from "@/lib/types";
import { requireInstitutionAdmin } from "@/server/auth";
import { getAssignments, getInstitutionOverview, getTeacherSummaries } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function InstitutionDashboardPage(props: PageProps<"/etablissement/[institutionId]">) {
  const { institutionId } = await props.params;
  const { institution } = await requireInstitutionAdmin(institutionId);
  const base = `/etablissement/${institutionId}`;
  const supabase = await createClient();

  const [overview, teachers, assignments] = await Promise.all([
    getInstitutionOverview(institutionId),
    getTeacherSummaries(institutionId),
    getAssignments(institutionId),
  ]);

  // Scope the feed to (teacher, course) pairs assigned by THIS institution.
  const pairs = new Set(assignments.map((a) => `${a.user_id}:${a.course_id}`));
  const { data: events } = assignments.length
    ? await supabase
        .from("learning_events")
        .select("id, event_type, occurred_at, user_id, course_id, user:profiles(id, full_name, email), course:courses(title)")
        .in("user_id", [...new Set(assignments.map((a) => a.user_id))])
        .in("course_id", [...new Set(assignments.map((a) => a.course_id))])
        .in("event_type", ["lesson_completed", "quiz_passed", "quiz_failed", "course_completed", "certificate_issued"])
        .order("occurred_at", { ascending: false })
        .limit(40)
    : { data: [] };

  const activity = ((events ?? []) as unknown as Array<{ user_id: string; course_id: string }>)
    .filter((e) => pairs.has(`${e.user_id}:${e.course_id}`))
    .slice(0, 10) as unknown as Array<{
    id: string;
    event_type: LearningEventType;
    occurred_at: string;
    user: { id: string; full_name: string; email: string } | null;
    course: { title: string } | null;
  }>;
  const needSupport = teachers.filter((t) => t.inactive || t.exhausted_quizzes > 0);
  const completionRatio = overview.assignments ? overview.completed_assignments / overview.assignments : 0;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`Suivi des formations affectées aux enseignants de ${institution.name}.`}
        actions={
          <>
            <Link href={`${base}/enseignants/invitations`} className={buttonClasses({ variant: "secondary" })}>
              <Mail aria-hidden /> Inviter des enseignants
            </Link>
            <Link href={`${base}/formations`} className={buttonClasses()}>
              <BookOpen aria-hidden /> Affecter une formation
            </Link>
          </>
        }
      />

      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Enseignants inscrits" value={overview.registered_teachers} icon={Users} detail={`${overview.pending_invitations} invitation(s) en attente`} />
        <StatTile
          label="Enseignants actifs"
          value={overview.active_teachers}
          icon={UserCheck}
          detail={`Activité sur les ${overview.inactivity_threshold_days} derniers jours`}
        />
        <StatTile
          label="Formations affectées"
          value={overview.assigned_courses}
          icon={BookOpen}
          detail={`${overview.authorized_courses} formation(s) autorisée(s) par SANADY`}
        />
        <StatTile label="Formations terminées" value={overview.completed_assignments} icon={CircleCheck} detail={`sur ${overview.assignments} affectation(s)`} />
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Avancement des affectations" description="Répartition de l’ensemble des formations affectées." />
            <CardBody>
              {overview.assignments === 0 ? (
                <p className="text-body text-ink-500">Aucune formation n’a encore été affectée.</p>
              ) : (
                <div className="space-y-5">
                  <ProgressBar value={completionRatio} label="Part des affectations terminées" tone="success" showValue />
                  <dl className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Terminées", value: overview.completed_assignments, dot: "bg-success-600" },
                      { label: "En cours", value: overview.in_progress_assignments, dot: "bg-teal-600" },
                      { label: "Non commencées", value: overview.not_started_assignments, dot: "bg-ink-300" },
                    ].map((s) => (
                      <div key={s.label}>
                        <dt className="flex items-center gap-2 text-label text-ink-600">
                          <span className={`size-2 rounded-full ${s.dot}`} aria-hidden /> {s.label}
                        </dt>
                        <dd className="tabular mt-1 text-section font-semibold text-ink-900">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Enseignants à accompagner"
              description="Inactivité prolongée ou tentatives d’évaluation épuisées. Ces indicateurs ne constituent pas une évaluation des compétences."
            />
            {needSupport.length === 0 ? (
              <EmptyState compact icon={LifeBuoy} title="Aucun signalement" description="Aucun enseignant ne présente d’indicateur d’accompagnement." />
            ) : (
              <ul className="divide-y divide-line">
                {needSupport.slice(0, 8).map((t) => (
                  <li key={t.user_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-body font-medium text-ink-900">{t.full_name || t.email}</p>
                      <p className="text-caption text-ink-500">
                        Dernière activité : {t.last_activity_at ? formatRelative(t.last_activity_at) : "aucune"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {t.inactive ? <Badge tone="warning">Inactif</Badge> : null}
                      {t.exhausted_quizzes > 0 ? <Badge tone="danger">Tentatives épuisées ({t.exhausted_quizzes})</Badge> : null}
                      <Link href={`${base}/suivi/${t.user_id}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
                        Suivi <ArrowRight aria-hidden />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Activité récente" description="Étapes franchies dans les formations affectées." />
          <CardBody>
            {activity.length === 0 ? (
              <p className="text-body text-ink-500">Aucune activité pour le moment.</p>
            ) : (
              <ol className="space-y-4">
                {activity.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-body text-ink-800">
                        <Link href={`${base}/suivi/${e.user?.id}`} className="font-medium hover:underline">
                          {e.user?.full_name || e.user?.email}
                        </Link>{" "}
                        — {EVENT_LABELS[e.event_type].toLowerCase()}
                      </p>
                      <p className="truncate text-caption text-ink-500">
                        {e.course?.title} · {formatDateTime(e.occurred_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
