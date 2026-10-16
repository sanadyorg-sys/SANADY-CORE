import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Library } from "lucide-react";
import { CourseCover } from "@/components/learning/course-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { formatDuration } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import { requireInstitutionViewer } from "@/server/auth";
import { getAuthorizedCourses } from "@/server/queries/institution";
import { ASSESSMENT_FEEDBACK, wording } from "@/lib/enterprise";
import { workspaceAssessmentPolicy } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Formations autorisées" };

export default async function AuthorizedCoursesPage(props: PageProps<"/etablissement/[institutionId]/formations">) {
  const { institutionId } = await props.params;
  const { institution } = await requireInstitutionViewer(institutionId);
  const say = wording(institution.kind);
  const [courses, policy] = await Promise.all([getAuthorizedCourses(institutionId), institution.kind === "enterprise" ? workspaceAssessmentPolicy(institutionId) : null]);
  const base = `/etablissement/${institutionId}/formations`;

  return (
    <>
      <PageHeader
        title="Formations autorisées"
        description={say("Formations que SANADY a autorisées pour votre établissement. Affectez-les aux enseignants concernés.")}
      />
      {policy ? (
        <Alert tone="info" className="mb-4" title="Règles d’évaluation de votre entreprise">
          {policy.pass_threshold} % pour réussir chaque évaluation, {policy.max_attempts} tentative{policy.max_attempts > 1 ? "s" : ""} ; bonnes réponses : {ASSESSMENT_FEEDBACK[policy.feedback].toLowerCase()} ;{" "}
          {policy.certificates ? "document délivré à la fin du parcours" : "pas de document de fin (la formation est marquée terminée)"}
          {policy.enforce_due_dates ? " ; les évaluations se ferment à la date limite que vous fixez en affectant une formation" : ""}.
        </Alert>
      ) : null}
      {courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Library}
            title="Aucune formation autorisée pour le moment"
            description={say("Les formations sont autorisées par l’équipe SANADY. Contactez-la pour connaître le catalogue disponible pour votre établissement.")}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id} className="flex flex-col overflow-hidden">
              <CourseCover path={c.cover_path} title={c.title} category={c.category} className="aspect-[16/7] border-b border-line" />
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex flex-wrap gap-2">
                  {c.category ? <Badge tone="brand">{c.category}</Badge> : null}
                  <Badge>{COURSE_LEVELS[c.level]}</Badge>
                </div>
                <h2 className="text-card font-semibold text-ink-900">{c.title}</h2>
                {c.summary ? <p className="mt-1 line-clamp-2 text-label text-ink-600">{c.summary}</p> : null}
                <p className="mt-2 inline-flex items-center gap-1 text-caption text-ink-500">
                  <Clock className="size-3.5" aria-hidden /> {formatDuration(c.estimated_minutes)}
                </p>
                <div className="mt-auto pt-5">
                  <div className="mb-1.5 flex justify-between text-caption text-ink-600">
                    <span>
                      {c.assigned_count} {say("enseignant")}{c.assigned_count > 1 ? "s" : ""} inscrit{c.assigned_count > 1 ? "s" : ""}
                    </span>
                    <span>{c.completed_count} terminé{c.completed_count > 1 ? "s" : ""}</span>
                  </div>
                  <ProgressBar value={c.assigned_count ? c.completed_count / c.assigned_count : 0} label={say("Part des enseignants ayant terminé")} size="sm" tone="success" />
                  <Link href={`${base}/${c.id}`} className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-4 w-full" })}>
                    Gérer les affectations
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
