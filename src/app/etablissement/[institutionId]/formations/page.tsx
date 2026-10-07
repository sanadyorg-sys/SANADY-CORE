import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Library } from "lucide-react";
import { CourseCover } from "@/components/learning/course-card";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ProgressBar } from "@/components/ui/feedback";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { formatDuration } from "@/lib/format";
import { COURSE_LEVELS } from "@/lib/labels";
import { requireInstitutionAdmin } from "@/server/auth";
import { getAuthorizedCourses } from "@/server/queries/institution";

export const metadata: Metadata = { title: "Formations autorisées" };

export default async function AuthorizedCoursesPage(props: PageProps<"/etablissement/[institutionId]/formations">) {
  const { institutionId } = await props.params;
  await requireInstitutionAdmin(institutionId);
  const courses = await getAuthorizedCourses(institutionId);
  const base = `/etablissement/${institutionId}/formations`;

  return (
    <>
      <PageHeader
        title="Formations autorisées"
        description="Formations que SANADY a autorisées pour votre établissement. Affectez-les aux enseignants concernés."
      />
      {courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Library}
            title="Aucune formation autorisée pour le moment"
            description="Les formations sont autorisées par l’équipe SANADY. Contactez-la pour connaître le catalogue disponible pour votre établissement."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id} className="flex flex-col overflow-hidden">
              <CourseCover path={c.cover_path} title={c.title} category={c.category} className="aspect-[16/7] border-b border-line" />
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex flex-wrap gap-2">
                  {c.category ? <Badge tone="navy">{c.category}</Badge> : null}
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
                      {c.assigned_count} enseignant{c.assigned_count > 1 ? "s" : ""} inscrit{c.assigned_count > 1 ? "s" : ""}
                    </span>
                    <span>{c.completed_count} terminé{c.completed_count > 1 ? "s" : ""}</span>
                  </div>
                  <ProgressBar value={c.assigned_count ? c.completed_count / c.assigned_count : 0} label="Part des enseignants ayant terminé" size="sm" tone="success" />
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
