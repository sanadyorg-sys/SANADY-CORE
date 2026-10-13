import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Pencil, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { ContractDocumentUpload, ContractForm, ContractLineForm, ContractStatusForm } from "@/components/enterprise/contract-forms";
import { HistoryList } from "@/components/partnerships/timeline";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/surface";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import { CONTRACT_STATUS, LINE_CATEGORIES, PRICING_MODELS, SERVICE_PLANS, contractNextSteps, lineTotal } from "@/lib/enterprise";
import { formatAmount } from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { applyContractToTenant, deleteContractLine } from "@/server/actions/contracts";
import { requireEnterpriseStaff } from "@/server/auth";
import { enterpriseActor, getContract } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Contrat — Enterprise" };

const DOC_LABELS: Record<string, string> = { signed: "Exemplaire signé", draft: "Projet de contrat", supporting: "Pièce justificative" };
const HISTORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CONTRACT_STATUS).map(([k, v]) => [k, v.label])),
  applied_to_tenant: "Limites appliquées à l’espace de formation",
  renewal_terms: "Échéance renouvelée",
};

export default async function ContractPage(props: PageProps<"/admin/partenariats/entreprises/contrats/[contractId]">) {
  const viewer = await requireEnterpriseStaff();
  const { contractId } = await props.params;
  if (!uuidSchema.safeParse(contractId).success) notFound();
  const [detail, actor] = await Promise.all([getContract(contractId), enterpriseActor(viewer)]);
  if (!detail) notFound();
  const { contract: c, lines, documents, history, tenants } = detail;
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const editable = actor.manager && c.status !== "closed" && c.status !== "internal_review" && c.status !== "approved";
  const draft = c.status === "draft";

  return (
    <>
      <Link href="/admin/partenariats/entreprises/contrats" className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> Contrats
      </Link>
      <PageHeader
        title={c.title}
        description={`${c.reference} · ${c.service === "partenariat" ? "" : SERVICE_PLANS[c.service]} · ${PRICING_MODELS[c.pricing_model]}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge>
            {c.organization ? (
              <Link href={`/admin/partenariats/entreprises/clients/${c.organization.id}`} className="text-label text-accent-700 hover:underline">
                {c.organization.name}
              </Link>
            ) : null}
            {editable ? (
              <Drawer
                title={draft ? "Conditions du contrat" : c.status === "renewal" ? "Renouvellement" : "Espace rattaché"}
                width="max-w-2xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <ContractForm contract={c} tenants={tenants} />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />
      <Alert tone={c.status === "approved" ? "warning" : "info"} className="mb-6">
        {c.status === "approved"
          ? `Approuvé${c.approver ? ` par ${displayName(c.approver)}` : ""}${c.approved_at ? ` le ${formatDateTime(c.approved_at)}` : ""}. La signature a lieu hors de la plateforme : un approbateur joint l’exemplaire signé puis enregistre la date.`
          : c.signed_on
            ? `Signé le ${formatDate(c.signed_on)}${c.recorder ? ` (enregistré par ${displayName(c.recorder)})` : ""}. Aucun montant n’est facturé par la plateforme.`
            : "Activité proposée : aucun montant n’est facturé ni prélevé par la plateforme."}
      </Alert>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Conditions" />
            <CardBody className="space-y-4">
              <DescriptionList
                items={[
                  { term: "Période", value: c.start_on && c.end_on ? `du ${formatDate(c.start_on)} au ${formatDate(c.end_on)}` : "—" },
                  { term: "Rappel de renouvellement", value: `${c.renewal_notice_days} jours avant la fin` },
                  { term: "Proposition d’origine", value: c.proposal ? <Link href={`/admin/partenariats/entreprises/propositions/${c.proposal.id}`} className="text-accent-700 hover:underline">{c.proposal.reference}</Link> : "—" },
                  { term: "Collaborateurs", value: c.learner_limit ?? "—" },
                  { term: "Stockage", value: c.storage_limit_gb ? `${c.storage_limit_gb} Go` : "—" },
                  { term: "Vidéo", value: c.video_minutes_limit ? `${c.video_minutes_limit.toLocaleString("fr-FR")} minutes / an` : "—" },
                  { term: "Espace de formation", value: c.tenant ? <Link href={`/admin/partenariats/entreprises/espaces/${c.tenant.id}`} className="text-accent-700 hover:underline">{c.tenant.display_name}</Link> : "—" },
                ]}
              />
              {[
                ["Conditions de renouvellement", c.renewal_terms],
                ["Engagements de support", c.support_commitments],
                ["Propriété et traitement des données", c.data_ownership],
                ["Propriété des contenus", c.content_ownership],
                ["Conditions de résiliation", c.termination_provisions],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <h3 className="text-label font-semibold text-ink-600">{k}</h3>
                    <p className="mt-1 whitespace-pre-line text-body text-ink-800">{v}</p>
                  </div>
                ))}
              {c.tenant && actor.manager && ["signed", "active", "renewal"].includes(c.status) ? (
                <ActionButton
                  action={applyContractToTenant.bind(null, c.id)}
                  confirm={{ title: "Appliquer à l’espace ?", description: "L’espace de formation reprend les limites et les dates de ce contrat.", confirmLabel: "Appliquer" }}
                >
                  Appliquer les limites à l’espace de formation
                </ActionButton>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Lignes du contrat" description={`Total : ${formatAmount(total, c.currency) ?? "—"} — montant contractuel, non facturé par la plateforme.`} />
            {lines.length ? (
              <Table caption="Lignes du contrat">
                <THead>
                  <TR>
                    <TH>Ligne</TH>
                    <TH align="right">Quantité</TH>
                    <TH align="right">Prix unitaire</TH>
                    <TH align="right">Total</TH>
                    {draft && actor.manager ? (
                      <TH align="right">
                        <span className="sr-only">Actions</span>
                      </TH>
                    ) : null}
                  </TR>
                </THead>
                <TBody>
                  {lines.map((l) => (
                    <TR key={l.id}>
                      <TD>
                        <span className="font-medium text-ink-900">{l.label}</span>
                        <span className="block text-caption text-ink-500">{LINE_CATEGORIES[l.category]}</span>
                      </TD>
                      <TD align="right">
                        {Number(l.quantity).toLocaleString("fr-FR")} {l.unit ?? ""}
                      </TD>
                      <TD align="right">{formatAmount(l.unit_price, c.currency)}</TD>
                      <TD align="right">{formatAmount(lineTotal(l), c.currency)}</TD>
                      {draft && actor.manager ? (
                        <TD align="right">
                          <ActionButton variant="danger-ghost" action={deleteContractLine.bind(null, l.id, c.id)}>
                            <Trash2 aria-hidden /> <span className="sr-only">Supprimer {l.label}</span>
                          </ActionButton>
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucune ligne.</p>
              </CardBody>
            )}
            {draft && actor.manager ? (
              <CardBody className="border-t border-line">
                <ContractLineForm contractId={c.id} currency={c.currency} />
              </CardBody>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Documents" description="Projet, exemplaire signé et pièces (PDF, stockage privé)." />
            <CardBody className="space-y-4">
              {documents.length ? (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                      <p className="flex min-w-0 flex-wrap items-center gap-2 text-body font-medium text-ink-900">
                        <span className="truncate">{d.file_name}</span>
                        <Badge tone={d.kind === "signed" ? "success" : "neutral"}>{DOC_LABELS[d.kind] ?? d.kind}</Badge>
                      </p>
                      <a
                        href={`/api/entreprises/documents/${d.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-label text-ink-800 hover:bg-ink-50"
                      >
                        <Download className="size-3.5" aria-hidden /> Télécharger
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink-600">Aucun document.</p>
              )}
              {c.status !== "closed" ? <ContractDocumentUpload contractId={c.id} canSign={actor.signatory && ["approved", "signed", "active", "renewal"].includes(c.status)} /> : null}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Statut" />
            <CardBody>
              <ContractStatusForm id={c.id} options={contractNextSteps(c.status, actor)} />
              {!actor.signatory ? <p className="mt-3 text-caption text-ink-500">L’approbation et l’enregistrement de la signature reviennent aux approbateurs habilités.</p> : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Historique" description={`Créé le ${formatDateTime(c.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={HISTORY_LABELS} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
