import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, Mail } from "lucide-react";
import { LearnerProgress } from "@/components/tracking/learner-progress";
import { buttonClasses } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { requireInstitutionAdmin } from "@/server/auth";
import { getAssignments, getTeacherSummaries } from "@/server/queries/institution";
import { getLearnerDetails } from "@/server/queries/tracking";

export const metadata: Metadata = { title: "Suivi d’un enseignant" };

export default async function TeacherTrackingPage(props: PageProps<"/etablissement/[institutionId]/suivi/[userId]">) {
  const { institutionId, userId } = await props.params;
  await requireInstitutionAdmin(institutionId);
  const base = `/etablissement/${institutionId}`;

  const [teachers, assignments] = await Promise.all([getTeacherSummaries(institutionId), getAssignments(institutionId, { userId })]);
  const teacher = teachers.find((t) => t.user_id === userId);
  if (!teacher) notFound();

  const assignedCourses = new Set(assignments.map((a) => a.course_id));
  const { courses, activity } = await getLearnerDetails(userId, (courseId) => assignedCourses.has(courseId));

  return (
    <>
      <Link href={`${base}/suivi`} className="mb-5 inline-flex items-center gap-1.5 text-label font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Suivi individuel
      </Link>
      <PageHeader
        title={teacher.full_name || teacher.email}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden /> {teacher.email}
            </span>
            <span>Membre depuis le {formatDate(teacher.joined_at)}</span>
          </span>
        }
        actions={
          <a href={`/api/rapports/${institutionId}/${userId}`} className={buttonClasses({ variant: "secondary" })}>
            <FileDown aria-hidden /> Rapport PDF
          </a>
        }
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {teacher.inactive ? <Badge tone="warning">Inactif depuis plus de la période de référence</Badge> : null}
          {teacher.exhausted_quizzes > 0 ? (
            <Badge tone="danger">
              {teacher.exhausted_quizzes} évaluation{teacher.exhausted_quizzes > 1 ? "s" : ""} aux tentatives épuisées — intervention SANADY requise
            </Badge>
          ) : null}
        </div>
      </PageHeader>

      <LearnerProgress
        courses={courses}
        activity={activity}
        attemptHref={(attemptId) => `${base}/suivi/${userId}/tentatives/${attemptId}`}
        emptyMessage="Aucune formation n’est affectée à cet enseignant par l’établissement."
      />
    </>
  );
}
