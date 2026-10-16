import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, FileText, PlayCircle } from "lucide-react";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { TRAINING_STATUS } from "@/lib/enterprise";
import { uuidSchema } from "@/lib/validation";
import { requireInstitutionAdmin } from "@/server/auth";
import { clientCoursePreview } from "@/server/queries/studio";

export const metadata: Metadata = { title: "Aperçu de la formation" };

/**
 * Company workspaces: the draft course of a custom-training project, for
 * the company's administrators while their review is awaited. Read-only;
 * nothing is recorded; the correct answers are never sent.
 */
export default async function ClientPreviewPage(props: PageProps<"/etablissement/[institutionId]/projets/[projectId]/apercu">) {
  const { institutionId, projectId } = await props.params;
  const { institution } = await requireInstitutionAdmin(institutionId);
  if (institution.kind !== "enterprise" || !uuidSchema.safeParse(projectId).success) notFound();
  const p = await clientCoursePreview(projectId);
  if (!p) notFound();
  const base = `/etablissement/${institutionId}/projets/${projectId}/apercu`;

  return (
    <>
      <Link href={`/etablissement/${institutionId}/projets`} className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Formations sur mesure
      </Link>
      <PageHeader title={p.course_title} description={`Aperçu de la formation préparée pour « ${p.project_title} »`} actions={<Badge tone={TRAINING_STATUS[p.status].tone}>{TRAINING_STATUS[p.status].label}</Badge>} />
      <Alert tone="info" className="mb-6">
        Version de travail, en lecture seule : rien n’est enregistré quand vous parcourez les leçons. Les bonnes réponses des évaluations ne sont pas affichées. Donnez votre avis depuis{" "}
        <Link href={`/etablissement/${institutionId}/projets`} className="font-medium underline">
          Formations sur mesure
        </Link>
        .
      </Alert>
      {p.description ? <p className="mb-6 whitespace-pre-line text-body text-ink-700">{p.description}</p> : null}
      <div className="space-y-6">
        {p.modules.map((m, i) => (
          <Card key={m.id}>
            <CardHeader title={`Module ${i + 1} — ${m.title}`} description={m.description ?? undefined} />
            <ul className="divide-y divide-line">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  <Link href={`${base}/lecons/${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                    {l.kind === "video" ? <PlayCircle className="size-4 shrink-0 text-ink-500" aria-hidden /> : <FileText className="size-4 shrink-0 text-ink-500" aria-hidden />}
                    <span className="min-w-0 flex-1 font-medium text-ink-900">{l.title}</span>
                    <span className="shrink-0 text-caption text-ink-500">{l.kind === "video" ? (l.minutes ? `${l.minutes} min` : "Vidéo") : l.pages ? `${l.pages} pages` : "PDF"}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {m.quiz ? (
              <CardBody id={`evaluation-${m.quiz.id}`} className="border-t border-line">
                <h3 className="flex items-center gap-2 text-label font-semibold text-ink-800">
                  <ClipboardCheck className="size-4 text-ink-500" aria-hidden /> {m.quiz.title} — {m.quiz.questions.length} question{m.quiz.questions.length > 1 ? "s" : ""}
                </h3>
                <ol className="mt-3 space-y-3">
                  {m.quiz.questions.map((q, qi) => (
                    <li key={qi} className="rounded-xl bg-ink-50 px-4 py-3">
                      <p className="text-body text-ink-900">
                        {qi + 1}. {q.prompt}
                        {q.kind === "multiple" ? <span className="ml-1 text-caption text-ink-500">(plusieurs réponses)</span> : null}
                      </p>
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-label text-ink-700">
                        {q.options.map((o, oi) => (
                          <li key={oi}>{o}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </CardBody>
            ) : null}
          </Card>
        ))}
        {p.modules.length === 0 ? <p className="text-body text-ink-600">Le contenu de la formation est encore en préparation.</p> : null}
      </div>
    </>
  );
}
