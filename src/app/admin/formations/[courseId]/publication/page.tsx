import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, Eye, Trash2, TriangleAlert } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, StatTile } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { PUBLICATION_ISSUES } from "@/lib/errors";
import { deleteCourse } from "@/server/actions/courses";
import { requireSanadyAdmin } from "@/server/auth";
import { getCourseEditorData } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Publication" };

export default async function PublicationPage(props: PageProps<"/admin/formations/[courseId]/publication">) {
  const { courseId } = await props.params;
  await requireSanadyAdmin();
  const data = await getCourseEditorData(courseId);
  if (!data) notFound();
  const { course, modules, issues, stats } = data;
  const lessons = modules.flatMap((m) => m.lessons);
  const firstPreviewable = lessons.find((l) => l.video_ref || l.pdf_path);
  const questions = modules.reduce((s, m) => s + (m.quiz?.question_count ?? 0), 0);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Modules" value={modules.length} />
        <StatTile label="Leçons" value={lessons.length} detail={`${lessons.filter((l) => l.is_mandatory).length} obligatoire(s)`} />
        <StatTile label="Questions d’évaluation" value={questions} />
        <StatTile label="Inscrits" value={stats.enrollments} detail={`${stats.completed} formation(s) terminée(s)`} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader
            title="Contrôle avant publication"
            description="La publication est refusée par la base de données tant que ces points ne sont pas réglés."
          />
          <CardBody>
            {issues.length === 0 ? (
              <Alert tone="success" title="Prête à être publiée">
                Tous les modules ont des leçons avec contenu et une évaluation correctement configurée.
                {course.status === "published" && course.published_at ? ` Publiée le ${formatDate(course.published_at)}.` : ""}
              </Alert>
            ) : (
              <ul className="space-y-2.5">
                {issues.map((issue, i) => (
                  <li key={i} className="flex gap-2.5 text-body text-ink-800">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
                    <span>
                      {PUBLICATION_ISSUES[issue.code] ?? issue.code}
                      {issue.label ? <span className="text-ink-500"> — « {issue.label} »</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ul className="mt-6 space-y-2 border-t border-line pt-4 text-label text-ink-600">
              {[
                "Chaque module se termine par une évaluation obligatoire (seuil 70 %, 3 tentatives).",
                "Le certificat est délivré automatiquement quand toutes les leçons obligatoires et toutes les évaluations sont validées.",
                "Après publication, les éléments déjà commencés par des enseignants sont archivés plutôt que supprimés.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-teal-600" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Aperçu" description="Parcourez les leçons comme un enseignant, sans enregistrer de progression." />
            <CardBody>
              {firstPreviewable ? (
                <Link href={`/admin/formations/${courseId}/apercu/lecons/${firstPreviewable.id}`} className={buttonClasses({ variant: "secondary" })}>
                  <Eye aria-hidden /> Ouvrir l’aperçu
                </Link>
              ) : (
                <p className="text-body text-ink-500">Ajoutez du contenu à une leçon pour pouvoir la prévisualiser.</p>
              )}
            </CardBody>
          </Card>
          {course.status === "draft" ? (
            <Card className="border-danger-200">
              <CardHeader title="Supprimer la formation" description="Possible uniquement pour un brouillon sans inscrit." />
              <CardBody>
                <ActionButton
                  variant="danger"
                  size="md"
                  action={deleteCourse.bind(null, courseId)}
                  confirm={{
                    title: "Supprimer définitivement cette formation ?",
                    description: "Les modules, leçons et évaluations du brouillon seront supprimés. Cette action est irréversible.",
                    confirmLabel: "Supprimer",
                  }}
                >
                  <Trash2 aria-hidden /> Supprimer le brouillon
                </ActionButton>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
