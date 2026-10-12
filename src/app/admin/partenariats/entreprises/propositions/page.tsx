import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { ENTERPRISE_SERVICES, PROPOSAL_STATUS, lineTotal, type ProposalStatus } from "@/lib/enterprise";
import { formatAmount } from "@/lib/partnerships";
import { requireEnterpriseStaff } from "@/server/auth";
import { listProposals } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Propositions — Enterprise" };

const TABS: Array<{ key: string; label: string; status?: ProposalStatus }> = [
  { key: "toutes", label: "Toutes" },
  { key: "brouillons", label: "Brouillons", status: "draft" },
  { key: "revue", label: "En revue", status: "internal_review" },
  { key: "approuvees", label: "À envoyer", status: "approved" },
  { key: "envoyees", label: "Envoyées", status: "sent" },
  { key: "acceptees", label: "Acceptées", status: "accepted" },
];

export default async function ProposalsPage(props: PageProps<"/admin/partenariats/entreprises/propositions">) {
  await requireEnterpriseStaff();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0]!;
  const rows = await listProposals({ status: tab.status });

  return (
    <>
      <PageHeader
        title="Propositions commerciales"
        description="Brouillon → revue interne → approbation (approbateur habilité) → envoi → réponse du client. Montants estimés, hors taxes, à valider avec la comptabilité."
      />
      <LinkTabs className="mb-4" activeHref={`/admin/partenariats/entreprises/propositions?onglet=${tab.key}`} items={TABS.map((t) => ({ href: `/admin/partenariats/entreprises/propositions?onglet=${t.key}`, label: t.label }))} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="Aucune proposition" description="Les propositions se créent depuis la fiche d’un client." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Propositions">
            <THead>
              <TR>
                <TH>Proposition</TH>
                <TH>Client</TH>
                <TH>Statut</TH>
                <TH align="right">Montant</TH>
                <TH>Validité</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link href={`/admin/partenariats/entreprises/propositions/${p.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {p.title}
                    </Link>
                    <span className="block text-caption text-ink-500">
                      {p.reference} · {ENTERPRISE_SERVICES[p.service].short}
                    </span>
                  </TD>
                  <TD>{p.organization?.name ?? "—"}</TD>
                  <TD>
                    <Badge tone={PROPOSAL_STATUS[p.status].tone}>{PROPOSAL_STATUS[p.status].label}</Badge>
                  </TD>
                  <TD align="right" className="tabular">{formatAmount(p.lines.reduce((t, l) => t + lineTotal(l), 0), p.currency)}</TD>
                  <TD>{p.valid_until ? formatDate(p.valid_until) : "—"}</TD>
                  <TD>{formatRelative(p.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
