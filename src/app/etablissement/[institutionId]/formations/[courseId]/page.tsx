import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target, UserMinus } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { AssignCourseForm } from "@/components/institution/assign-course-form";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { formatDate, formatDuration, formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { unassignCourse } from "@/server/actions/institution";
import { requireInstitutionAdmin } from "@/server/auth";
import { getAssignments, getAuthorizedCourses, getTeacherSummaries } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Affectations" };

export default async function CourseAssignmentPage(props: PageProps<"/etablissement/[institutionId]/formations/[courseId]">) {
  const { institutionId, courseId } = await props.params;
  await requireInstitutionAdmin(institutionId);
  const supabase = await createClient();

  const [courses, teachers, assignments] = await Promise.all([
    getAuthorizedCourses(institutionId),
    getTeacherSummaries(institutionId),
    getAssignments(institutionId, { courseId }),
  ]);
  const course = courses.find((c) => c.id === courseId);
  if (!course) notFound();

  const [{ data: details }, { data: enrollments }] = await Promise.all([
    supabase.from("courses").select("objectives, target_audience").eq("id", courseId).maybeSingle(),
    assignments.length
      ? supabase
          .from("enrollments")
          .select("user_id, status, started_at, last_activity_at")
          .eq("course_id", courseId)
          .in("user_id", assignments.map((a) => a.user_id))
      : Promise.resolve({ data: [] }),
  ]);
  const info = details as { objectives: string[]; target_audience: string } | null;
  const enrollmentByUser = new Map(
    ((enrollments ?? []) as Array<{ user_id: string; status: string; started_at: string | null; last_activity_at: string | null }>).map((e) => [e.user_id, e]),
  );
  const teacherById = new Map(teachers.map((t) => [t.user_id, t]));
  const assignedIds = new Set(assignments.map((a) => a.user_id));
  const base = `/etablissement/${institutionId}`;

  return (
    <>
      <Link href={`${base}/formations`} className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Formations autorisées
      </Link>
      <PageHeader
        title={course.title}
        description={course.summary || undefined}
        eyebrow={`${formatDuration(course.estimated_minutes)}${course.category ? ` · ${course.category}` : ""}`}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader
            title="Enseignants inscrits"
            description={`${assignments.length} affectation${assignments.length > 1 ? "s" : ""} en cours`}
          />
          {assignments.length === 0 ? (
            <EmptyState compact title="Aucun enseignant inscrit" description="Utilisez le formulaire pour affecter cette formation." />
          ) : (
            <Table caption="Enseignants inscrits à la formation">
              <THead>
                <tr>
                  <TH>Enseignant</TH>
                  <TH>Affectée le</TH>
                  <TH>Statut</TH>
                  <TH>Dernière activité</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {assignments.map((a) => {
                  const t = teacherById.get(a.user_id);
                  const e = enrollmentByUser.get(a.user_id);
                  return (
                    <TR key={a.id}>
                      <TD>
                        <Link href={`${base}/suivi/${a.user_id}`} className="font-medium text-ink-900 hover:underline">
                          {t?.full_name || t?.email || "Enseignant"}
                        </Link>
                        {a.due_on ? <p className="text-caption text-ink-500">Échéance : {formatDate(a.due_on)}</p> : null}
                      </TD>
                      <TD>{formatDate(a.assigned_at)}</TD>
                      <TD>
                        {e?.status === "completed" ? (
                          <Badge tone="success">Terminée</Badge>
                        ) : e?.started_at ? (
                          <Badge tone="teal">En cours</Badge>
                        ) : (
                          <Badge>Non commencée</Badge>
                        )}
                      </TD>
                      <TD>{e?.last_activity_at ? formatRelative(e.last_activity_at) : "—"}</TD>
                      <TD align="right">
                        <ActionButton
                          variant="danger-ghost"
                          action={unassignCourse.bind(null, a.id, institutionId)}
                          confirm={{
                            title: "Retirer cette affectation ?",
                            description:
                              "L’enseignant n’aura plus accès à la formation via l’établissement. Sa progression est conservée et réapparaîtra si la formation lui est de nouveau affectée.",
                            confirmLabel: "Retirer l’affectation",
                          }}
                        >
                          <UserMinus aria-hidden /> <span className="sr-only sm:not-sr-only">Retirer</span>
                        </ActionButton>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Affecter la formation" />
            <CardBody>
              <AssignCourseForm
                institutionId={institutionId}
                courseId={courseId}
                teachers={teachers.map((t) => ({
                  user_id: t.user_id,
                  full_name: t.full_name,
                  email: t.email,
                  alreadyAssigned: assignedIds.has(t.user_id),
                }))}
              />
            </CardBody>
          </Card>
          {info?.objectives?.length ? (
            <Card>
              <CardHeader title="Objectifs" />
              <CardBody>
                <ul className="space-y-2">
                  {info.objectives.map((o, i) => (
                    <li key={i} className="flex gap-2.5 text-body text-ink-700">
                      <Target className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden /> {o}
                    </li>
                  ))}
                </ul>
                {info.target_audience ? <p className="mt-4 text-label text-ink-500">Public visé : {info.target_audience}</p> : null}
              </CardBody>
            </Card>
          ) : null}
          <Link href={`${base}/formations`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            Retour au catalogue
          </Link>
        </div>
      </div>
    </>
  );
}
