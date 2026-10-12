import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { ContributionForm, ContributionStageForm, DocumentUpload } from "@/components/partnerships/agreement-forms";
import { DocumentList } from "@/components/partnerships/document-list";
import { HistoryList } from "@/components/partnerships/timeline";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import { CONTRIBUTION_KINDS, CONTRIBUTION_STAGE, contributionNextSteps, formatAmount } from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { requirePartnershipStaff } from "@/server/auth";
import { getContribution, linkOptions } from "@/server/queries/agreements";
import { pipelineActor } from "@/server/queries/partnerships";

export const metadata: Metadata = { title: "Contribution d’un partenaire" };

const LABELS = Object.fromEntries(Object.entries(CONTRIBUTION_STAGE).map(([k, v]) => [k, v.label]));

export default async function ContributionPage(props: PageProps<"/admin/partenariats/contributions/[contributionId]">) {
  const viewer = await requirePartnershipStaff();
  const { contributionId } = await props.params;
  if (!uuidSchema.safeParse(contributionId).success) notFound();
  const [detail, actor] = await Promise.all([getContribution(contributionId), pipelineActor(viewer)]);
  if (!detail) notFound();
  const { contribution: c, documents, history } = detail;
  const links = await linkOptions(c.organization_id);
  const open = c.stage !== "verified" && c.stage !== "cancelled";
  const editable = actor.staff && (c.stage === "pledged" || c.stage === "committed");

  const rows =
    c.kind === "financial"
      ? [
          { term: "Montant promis", value: formatAmount(c.amount_pledged, c.currency) ?? "—" },
          { term: "Montant reçu", value: formatAmount(c.amount_received, c.currency) ?? "Pas encore reçu" },
          { term: "Affectation", value: c.restricted_purpose ?? "—" },
        ]
      : c.kind === "material"
        ? [
            { term: "Matériel", value: [c.quantity ? `${c.quantity} ×` : null, c.item].filter(Boolean).join(" ") },
            { term: "Valeur estimée", value: c.estimated_value ? `${formatAmount(c.estimated_value, "MAD")} (estimation)` : "—" },
            { term: "Bénéficiaire", value: c.recipient ?? "—" },
          ]
        : [
            { term: "Expertise", value: c.expertise_category ?? "—" },
            { term: "Heures prévues", value: c.hours_pledged ? `${c.hours_pledged} h` : "—" },
            { term: "Heures réalisées", value: c.hours_delivered ? `${c.hours_delivered} h` : "Pas encore réalisées" },
            { term: "Activités soutenues", value: c.supported_activities ?? "—" },
          ];

  return (
    <>
      <Link href="/admin/partenariats/contributions" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Contributions
      </Link>
      <PageHeader
        title={c.description}
        description={`Contribution ${CONTRIBUTION_KINDS[c.kind].toLowerCase()} · ${c.organization?.name ?? ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={CONTRIBUTION_STAGE[c.stage].tone}>{CONTRIBUTION_STAGE[c.stage].label}</Badge>
            {editable ? (
              <Drawer
                title="Modifier la contribution"
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <ContributionForm organizationId={c.organization_id} contribution={c} agreements={links.agreements} opportunities={links.opportunities} />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />
      {c.stage === "delivered" ? (
        <Alert tone="warning" className="mb-6">
          Reçue : un approbateur vérifie la contribution, une preuve de réception (PDF) à l’appui.
        </Alert>
      ) : null}
      {c.stage === "verified" ? (
        <Alert tone="success" className="mb-6">
          Vérifiée{c.verifier ? ` par ${displayName(c.verifier)}` : ""}
          {c.verified_at ? ` le ${formatDateTime(c.verified_at)}` : ""}.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Contribution" />
            <CardBody>
              <DescriptionList
                items={[
                  {
                    term: "Partenaire",
                    value: c.organization ? (
                      <Link href={`/admin/partenariats/organisations/${c.organization.id}`} className="text-accent-700 hover:underline">
                        {c.organization.name}
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    term: "Convention",
                    value: c.agreement ? (
                      <Link href={`/admin/partenariats/conventions/${c.agreement.id}`} className="text-accent-700 hover:underline">
                        {c.agreement.reference}
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  ...rows,
                  { term: "Attendue le", value: c.expected_on ? formatDate(c.expected_on) : "—" },
                  { term: "Reçue le", value: c.received_on ? formatDate(c.received_on) : "—" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Preuves et justificatifs" description="Reçu, bon de livraison, attestation de réalisation… (PDF)." />
            <CardBody className="space-y-4">
              <DocumentList documents={documents} target="contribution" targetId={c.id} canDelete={() => actor.staff && open} />
              {open ? <DocumentUpload target="contribution" targetId={c.id} kinds={["evidence", "supporting"]} /> : null}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Étape" />
            <CardBody>
              <ContributionStageForm id={c.id} kind={c.kind} currency={c.currency} options={contributionNextSteps(c.stage, actor)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Historique" description={`Enregistrée le ${formatDateTime(c.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={LABELS} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
