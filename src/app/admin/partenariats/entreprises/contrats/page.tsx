import type { Metadata } from "next";
import Link from "next/link";
import { FilePenLine } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { CONTRACT_STATUS, PRICING_MODELS, SERVICE_PLANS, type ContractStatus } from "@/lib/enterprise";
import { requireEnterpriseStaff } from "@/server/auth";
import { listContracts } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Contrats — Enterprise" };

const TABS: Array<{ key: string; label: string; status?: ContractStatus }> = [
  { key: "tous", label: "Tous" },
  { key: "brouillons", label: "Brouillons", status: "draft" },
  { key: "revue", label: "En revue", status: "internal_review" },
  { key: "a-signer", label: "À signer", status: "approved" },
  { key: "en-cours", label: "En cours", status: "active" },
  { key: "renouvellement", label: "Renouvellement", status: "renewal" },
  { key: "clos", label: "Clos", status: "closed" },
];

export default async function ContractsPage(props: PageProps<"/admin/partenariats/entreprises/contrats">) {
  await requireEnterpriseStaff();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0]!;
  const rows = await listContracts({ status: tab.status });
  const today = new Date();

  return (
    <>
      <PageHeader
        title="Contrats"
        description="Préparés à partir d’une proposition acceptée : revue interne → approbation (approbateur) → signature enregistrée avec l’exemplaire signé → en cours → renouvellement ou clôture."
      />
      <Alert tone="info" className="mb-4">
        Activité proposée : aucun montant n’est facturé ni prélevé par la plateforme. Un contrat se crée depuis une proposition acceptée.
      </Alert>
      <LinkTabs
        className="mb-4"
        activeHref={`/admin/partenariats/entreprises/contrats?onglet=${tab.key}`}
        items={TABS.map((t) => ({ href: `/admin/partenariats/entreprises/contrats?onglet=${t.key}`, label: t.label }))}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={FilePenLine} title="Aucun contrat" description="Les contrats apparaissent ici dès leur création à partir d’une proposition acceptée." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Contrats commerciaux">
            <THead>
              <TR>
                <TH>Contrat</TH>
                <TH>Client</TH>
                <TH>Service</TH>
                <TH>Statut</TH>
                <TH>Période</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((c) => {
                const renewal = (c.status === "signed" || c.status === "active") && c.end_on && new Date(c.end_on).getTime() - c.renewal_notice_days * 86400000 <= today.getTime();
                return (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/admin/partenariats/entreprises/contrats/${c.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                        {c.title}
                      </Link>
                      <span className="block text-caption text-ink-500">
                        {c.reference} · {PRICING_MODELS[c.pricing_model]}
                      </span>
                    </TD>
                    <TD>{c.organization?.name ?? "—"}</TD>
                    <TD>{c.service === "partenariat" ? "—" : SERVICE_PLANS[c.service]}</TD>
                    <TD>
                      <Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge>
                    </TD>
                    <TD className={renewal ? "font-semibold text-warning-700" : undefined}>
                      {c.start_on && c.end_on ? `${formatDate(c.start_on)} → ${formatDate(c.end_on)}` : "—"}
                      {renewal ? <span className="block text-caption">Renouvellement à préparer</span> : null}
                    </TD>
                    <TD>{formatRelative(c.updated_at)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
