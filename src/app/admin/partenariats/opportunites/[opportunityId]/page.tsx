import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { HistoryList, NotesList } from "@/components/partnerships/timeline";
import { OpportunityForm, StatusChangeForm, TargetNoteForm } from "@/components/partnerships/target-forms";
import { Button, buttonClasses } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import {
  APPLICATION_STATUS,
  CONTRIBUTION_TYPES,
  INTERVENTION_FIELDS,
  OPPORTUNITY_STATUS,
  formatAmount,
  opportunityNextSteps,
} from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { requirePartnershipStaff } from "@/server/auth";
import { getOpportunity, pipelineActor } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Projet à la recherche de partenaires" };

const ACTION_LABELS: Record<string, string> = {
  internal_review: "Soumettre à la revue interne",
  draft: "Renvoyer en brouillon",
  approved: "Approuver la publication (approbateur)",
  published: "Publier sur le site",
  closed: "Clôturer (plus de candidatures)",
  archived: "Archiver",
};

export default async function OpportunityPage(props: PageProps<"/admin/partenariats/opportunites/[opportunityId]">) {
  const viewer = await requirePartnershipStaff();
  const { opportunityId } = await props.params;
  if (!uuidSchema.safeParse(opportunityId).success) notFound();
  const [detail, actor] = await Promise.all([getOpportunity(opportunityId), pipelineActor(viewer)]);
  if (!detail) notFound();
  const { opportunity: o, notes, history, applications } = detail;
  const editable = o.status === "draft" || o.status === "internal_review";
  const steps = opportunityNextSteps(o.status, actor);
  const labels = Object.fromEntries(Object.entries(OPPORTUNITY_STATUS).map(([k, v]) => [k, v.label]));
  const isPublic = o.status === "published" || o.status === "closed";

  return (
    <>
      <Link href="/admin/partenariats/opportunites" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Projets
      </Link>
      <PageHeader
        title={o.title}
        description={`${o.reference} · ${INTERVENTION_FIELDS[o.intervention_field]?.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={OPPORTUNITY_STATUS[o.status].tone}>{OPPORTUNITY_STATUS[o.status].label}</Badge>
            {isPublic ? (
              <a href={`/partenariats/opportunites/${o.reference}`} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "secondary" })}>
                Voir la page publique <ExternalLink aria-hidden />
              </a>
            ) : null}
            {editable ? (
              <Drawer
                title="Modifier le projet"
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <OpportunityForm opportunity={o} />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />
      {!editable ? (
        <Alert tone="info" className="mb-6">
          Contenu figé : il a été approuvé{o.approver ? ` par ${displayName(o.approver)}` : ""}
          {o.approved_at ? ` le ${formatDateTime(o.approved_at)}` : ""}. Pour le modifier, renvoyez le projet en brouillon (il devra être approuvé à nouveau).
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Fiche du projet" description={o.need ? `Issu du besoin ${o.need.reference} — ${o.need.title}` : undefined} />
            <CardBody className="space-y-4">
              <p className="text-body font-medium text-ink-900">{o.summary}</p>
              <DescriptionList
                items={[
                  { term: "Bénéficiaires", value: o.beneficiaries },
                  { term: "Zone géographique", value: o.geographic_scope ?? "—" },
                  { term: "Contributions recherchées", value: o.contribution_types.map((c) => CONTRIBUTION_TYPES[c]).join(", ") },
                  { term: "Objectif de financement", value: formatAmount(o.funding_target, o.currency) ?? "—" },
                  { term: "Calendrier", value: o.timeline ?? "—" },
                  { term: "Département", value: o.department ?? "—" },
                  { term: "Date limite", value: o.deadline ? formatDate(o.deadline) : "—" },
                ]}
              />
              {[
                ["Description", o.description],
                ["Objectifs éducatifs", o.objectives],
                ["Contribution attendue", o.expected_contribution],
                ["Expertise ou ressources nécessaires", o.required_resources],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <h3 className="text-label font-semibold text-ink-600">{k}</h3>
                    <p className="mt-1 whitespace-pre-line text-body text-ink-800">{v}</p>
                  </div>
                ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notes internes" />
            <CardBody className="space-y-5">
              <TargetNoteForm opportunityId={o.id} />
              <NotesList notes={notes} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Publication" />
            <CardBody>
              <StatusChangeForm
                id={o.id}
                kind="opportunity"
                options={steps.map((s) => ({ value: s, label: ACTION_LABELS[s] ?? s }))}
                help={
                  o.status === "internal_review" && !actor.signatory
                    ? "L’approbation de la publication revient à un approbateur habilité."
                    : o.status === "approved"
                      ? "Approuvé : le projet peut être publié sur le site public."
                      : undefined
                }
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Candidatures reçues" description={`${applications.length} candidature(s)`} />
            {applications.length ? (
              <ul className="divide-y divide-line">
                {applications.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <Link href={`/admin/partenariats/candidatures/${a.id}`} className="font-medium text-ink-900 hover:text-accent-700 hover:underline">
                      {a.org_name}
                    </Link>
                    <span className="block text-caption text-ink-500">
                      {a.reference} · {APPLICATION_STATUS[a.status].label} · {formatDate(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucune candidature pour ce projet.</p>
              </CardBody>
            )}
          </Card>
          <Card>
            <CardHeader title="Historique" description={`Créé le ${formatDateTime(o.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={labels} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
