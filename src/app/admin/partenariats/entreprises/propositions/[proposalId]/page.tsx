import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { EnterpriseNoteForm, EnterpriseStatusForm, LineForm, ProposalForm } from "@/components/enterprise/admin-forms";
import { HistoryList, NotesList } from "@/components/partnerships/timeline";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/surface";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { displayName, formatDate, formatDateTime } from "@/lib/format";
import { ENTERPRISE_SERVICES, LINE_CATEGORIES, PROPOSAL_STATUS, lineTotal, proposalNextSteps } from "@/lib/enterprise";
import { formatAmount } from "@/lib/partnerships";
import { uuidSchema } from "@/lib/validation";
import { createContractFromProposal } from "@/server/actions/contracts";
import { deleteLine } from "@/server/actions/enterprise";
import { requireEnterpriseStaff } from "@/server/auth";
import { contractForProposal, enterpriseActor, getProposal } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Proposition — Enterprise" };

const ACTION_LABELS: Record<string, string> = {
  internal_review: "Soumettre à la revue interne",
  draft: "Renvoyer en brouillon",
  approved: "Approuver la proposition (approbateur)",
  sent: "Marquer comme envoyée au client",
  accepted: "Acceptée par le client",
  declined: "Refusée par le client",
  expired: "Expirée sans réponse",
};

const num = (v: string | number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(v));

export default async function ProposalPage(props: PageProps<"/admin/partenariats/entreprises/propositions/[proposalId]">) {
  const viewer = await requireEnterpriseStaff();
  const { proposalId } = await props.params;
  if (!uuidSchema.safeParse(proposalId).success) notFound();
  const [detail, actor, contract] = await Promise.all([getProposal(proposalId), enterpriseActor(viewer), contractForProposal(proposalId)]);
  if (!detail) notFound();
  const { proposal: p, lines, notes, history } = detail;
  const editable = actor.manager && (p.status === "draft" || p.status === "internal_review");
  const total = lines.reduce((t, l) => t + lineTotal(l), 0);
  const labels = Object.fromEntries(Object.entries(PROPOSAL_STATUS).map(([k, v]) => [k, v.label]));

  return (
    <>
      <Link href={p.organization ? `/admin/partenariats/entreprises/clients/${p.organization.id}` : "/admin/partenariats/entreprises/propositions"} className="mb-3 inline-flex items-center gap-1.5 text-label text-ink-600 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden /> {p.organization?.name ?? "Propositions"}
      </Link>
      <PageHeader
        title={p.title}
        description={`${p.reference} · ${ENTERPRISE_SERVICES[p.service].label}${p.valid_until ? ` · valable jusqu’au ${formatDate(p.valid_until)}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PROPOSAL_STATUS[p.status].tone}>{PROPOSAL_STATUS[p.status].label}</Badge>
            {contract ? (
              <Link href={`/admin/partenariats/entreprises/contrats/${contract.id}`} className="text-label font-medium text-accent-700 hover:underline">
                Contrat {contract.reference}
              </Link>
            ) : p.status === "accepted" && p.service !== "partenariat" && actor.manager ? (
              <ActionButton
                variant="accent"
                size="md"
                action={createContractFromProposal.bind(null, p.id)}
                confirm={{ title: "Préparer le contrat ?", description: "Un contrat en brouillon reprend les lignes de cette proposition ; il sera approuvé puis signé.", confirmLabel: "Préparer" }}
              >
                Préparer le contrat
              </ActionButton>
            ) : null}
            {editable ? (
              <Drawer
                title="Modifier la proposition"
                width="max-w-xl"
                trigger={
                  <Button variant="secondary">
                    <Pencil aria-hidden /> Modifier
                  </Button>
                }
              >
                <div className="p-5">
                  <ProposalForm proposal={p} />
                </div>
              </Drawer>
            ) : null}
          </div>
        }
      />
      <Alert tone="warning" className="mb-6">
        Activité en projet : ne pas envoyer de proposition à un client avant l’autorisation formelle de la Fondation. Montants hors taxes, sans valeur
        contractuelle tant qu’aucun contrat n’est signé.
      </Alert>
      {!editable && p.approved_at ? (
        <Alert tone="info" className="mb-6">
          Approuvée{p.approver ? ` par ${displayName(p.approver)}` : ""} le {formatDateTime(p.approved_at)} : les lignes ne sont plus modifiables.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="Détail chiffré" description="Chaque service fait l’objet d’une ligne distincte (aucun prix n’est fixé par défaut)." />
            {lines.length ? (
              <Table caption="Lignes de la proposition">
                <THead>
                  <TR>
                    <TH>Prestation</TH>
                    <TH align="right">Quantité</TH>
                    <TH align="right">Prix unitaire</TH>
                    <TH align="right">Total</TH>
                    {editable ? <TH align="right"><span className="sr-only">Actions</span></TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {lines.map((l) => (
                    <TR key={l.id}>
                      <TD>
                        <span className="font-medium text-ink-900">{l.label}</span>
                        <span className="block text-caption text-ink-500">{LINE_CATEGORIES[l.category]}</span>
                      </TD>
                      <TD align="right" className="tabular">
                        {num(l.quantity)} {l.unit ?? ""}
                      </TD>
                      <TD align="right" className="tabular">{formatAmount(l.unit_price, p.currency)}</TD>
                      <TD align="right" className="tabular font-semibold">{formatAmount(lineTotal(l), p.currency)}</TD>
                      {editable ? (
                        <TD align="right">
                          <ActionButton variant="danger-ghost" action={deleteLine.bind(null, l.id, p.id)}>
                            <Trash2 aria-hidden /> <span className="sr-only">Supprimer {l.label}</span>
                          </ActionButton>
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                  <TR>
                    <TD className="font-bold text-ink-900">Total estimé (hors taxes)</TD>
                    <TD />
                    <TD />
                    <TD align="right" className="tabular text-section font-bold text-ink-900">{formatAmount(total, p.currency)}</TD>
                    {editable ? <TD /> : null}
                  </TR>
                </TBody>
              </Table>
            ) : (
              <CardBody>
                <p className="text-body text-ink-600">Aucune ligne pour l’instant.</p>
              </CardBody>
            )}
            {editable ? (
              <CardBody className="border-t border-line">
                <LineForm proposalId={p.id} currency={p.currency} />
              </CardBody>
            ) : null}
          </Card>
          {p.summary ? (
            <Card>
              <CardHeader title="Présentation" />
              <CardBody>
                <p className="whitespace-pre-line text-body text-ink-800">{p.summary}</p>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Notes internes" />
            <CardBody className="space-y-5">
              {actor.manager ? <EnterpriseNoteForm proposalId={p.id} /> : null}
              <NotesList notes={notes} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Validation et envoi" />
            <CardBody>
              <EnterpriseStatusForm
                kind="proposal"
                id={p.id}
                options={proposalNextSteps(p.status, actor).map((s) => ({ value: s, label: ACTION_LABELS[s] ?? s }))}
                help={p.status === "internal_review" && !actor.signatory ? "L’approbation revient à un approbateur habilité (pas à un administrateur technique)." : undefined}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Historique" description={`Créée le ${formatDateTime(p.created_at)}`} />
            <CardBody>
              <HistoryList history={history} labels={labels} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
