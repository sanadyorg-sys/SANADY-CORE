import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Clapperboard, Eye } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { ReviewForm } from "@/components/enterprise/studio-forms";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";
import { TRAINING_STATUS } from "@/lib/enterprise";
import { requireInstitutionAdmin } from "@/server/auth";
import { workspaceProjects } from "@/server/queries/studio";

export const metadata: Metadata = { title: "Formations sur mesure" };

/** Company workspaces: the custom training SANADY prepares for the company. */
export default async function WorkspaceProjectsPage(props: PageProps<"/etablissement/[institutionId]/projets">) {
  const { institutionId } = await props.params;
  const { institution } = await requireInstitutionAdmin(institutionId);
  if (institution.kind !== "enterprise") notFound();
  const projects = await workspaceProjects(institutionId);

  return (
    <>
      <PageHeader title="Formations sur mesure" description="Les formations que la Fondation Sanady conçoit pour votre entreprise, et leur avancement." />
      {projects.some((p) => p.status === "client_review") ? (
        <Alert tone="warning" className="mb-6">
          Votre avis est attendu sur un programme : validez-le ou indiquez les modifications souhaitées.
        </Alert>
      ) : null}
      {projects.length === 0 ? (
        <Card>
          <EmptyState icon={Clapperboard} title="Aucune formation en préparation" description="Les projets conçus pour votre entreprise apparaîtront ici." />
        </Card>
      ) : (
        <div className="space-y-6">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader
                title={p.title}
                description={`${p.reference}${p.version > 1 ? ` · version ${p.version}` : ""}${p.due_on ? ` · échéance ${formatDate(p.due_on)}` : ""}`}
                actions={<Badge tone={TRAINING_STATUS[p.status].tone}>{TRAINING_STATUS[p.status].label}</Badge>}
              />
              <CardBody className="space-y-4">
                <p className="text-label text-ink-600">Public : {p.target_audience}</p>
                {p.objectives ? (
                  <div>
                    <h3 className="text-label font-semibold text-ink-700">Objectifs</h3>
                    <p className="mt-1 whitespace-pre-line text-body text-ink-800">{p.objectives}</p>
                  </div>
                ) : null}
                {p.outline.length ? (
                  <div>
                    <h3 className="text-label font-semibold text-ink-700">Programme</h3>
                    <ol className="mt-2 space-y-2">
                      {p.outline.map((o, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="font-mono text-caption text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                          <span>
                            <span className="font-medium text-ink-900">{o.title}</span>
                            {o.description ? <span className="block text-label text-ink-600">{o.description}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {p.can_preview ? (
                  <Link href={`/etablissement/${institutionId}/projets/${p.id}/apercu`} className={buttonClasses({ variant: "secondary" })}>
                    <Eye aria-hidden /> Voir le contenu de la formation
                  </Link>
                ) : null}
                {p.status === "client_review" ? (
                  <div className="rounded-xl border border-warning-200 bg-warning-50/50 p-4">
                    <p className="mb-3 text-label font-medium text-ink-800">Votre validation</p>
                    <ReviewForm projectId={p.id} kind="client" institutionId={institutionId} />
                  </div>
                ) : null}
                {p.status === "launched" ? (
                  <p className="text-label text-success-700">La formation est disponible : affectez-la à vos collaborateurs depuis « Formations autorisées ».</p>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
