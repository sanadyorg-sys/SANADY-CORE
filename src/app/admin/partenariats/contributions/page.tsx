import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { CONTRIBUTION_KINDS, CONTRIBUTION_STAGE, contributionAmount, formatAmount, type ContributionStage } from "@/lib/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { contributionTotals, listContributions } from "@/server/queries/agreements";

export const metadata: Metadata = { title: "Contributions des partenaires" };

const TABS: Array<{ key: string; label: string; stage?: ContributionStage }> = [
  { key: "toutes", label: "Toutes" },
  { key: "promises", label: "Promises", stage: "pledged" },
  { key: "engagees", label: "Engagées", stage: "committed" },
  { key: "recues", label: "Reçues — à vérifier", stage: "delivered" },
  { key: "verifiees", label: "Vérifiées", stage: "verified" },
  { key: "annulees", label: "Annulées", stage: "cancelled" },
];

export default async function ContributionsPage(props: PageProps<"/admin/partenariats/contributions">) {
  await requirePartnershipStaff();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0]!;
  const [rows, totals] = await Promise.all([listContributions({ stage: tab.stage }), contributionTotals()]);
  const today = new Date().toISOString().slice(0, 10);

  // Financial totals per currency, kept apart: promised, actually received, verified.
  const money = new Map<string, { promised: number; received: number; verified: number }>();
  for (const t of totals.filter((x) => x.kind === "financial" && x.stage !== "cancelled")) {
    const m = money.get(t.currency) ?? { promised: 0, received: 0, verified: 0 };
    m.promised += Number(t.pledged ?? 0);
    if (t.stage === "delivered" || t.stage === "verified") m.received += Number(t.received ?? 0);
    if (t.stage === "verified") m.verified += Number(t.received ?? 0);
    money.set(t.currency, m);
  }

  return (
    <>
      <PageHeader
        title="Contributions des partenaires"
        description="Financières, matérielles ou d’expertise : promise → engagée → reçue → vérifiée par un approbateur, preuve à l’appui."
      />
      {money.size ? (
        <Card className="mb-6">
          <CardHeader title="Contributions financières" description="Hors contributions annulées. Une promesse n’est jamais comptée comme reçue." />
          <Table caption="Totaux financiers par devise">
            <THead>
              <TR>
                <TH>Devise</TH>
                <TH align="right">Promis (total)</TH>
                <TH align="right">Reçu</TH>
                <TH align="right">dont vérifié</TH>
              </TR>
            </THead>
            <TBody>
              {[...money.entries()].map(([cur, m]) => (
                <TR key={cur}>
                  <TD>{cur}</TD>
                  <TD align="right">{formatAmount(m.promised, cur) ?? "—"}</TD>
                  <TD align="right">{formatAmount(m.received, cur) ?? "—"}</TD>
                  <TD align="right">{formatAmount(m.verified, cur) ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : null}
      <Alert tone="info" className="mb-4">
        Une contribution s’enregistre depuis la fiche de l’organisation ou depuis une convention.
      </Alert>
      <LinkTabs className="mb-4" activeHref={`/admin/partenariats/contributions?onglet=${tab.key}`} items={TABS.map((t) => ({ href: `/admin/partenariats/contributions?onglet=${t.key}`, label: t.label }))} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={HandCoins} title="Aucune contribution" description="Les contributions des partenaires apparaissent ici." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Contributions des partenaires">
            <THead>
              <TR>
                <TH>Contribution</TH>
                <TH>Partenaire</TH>
                <TH>Type</TH>
                <TH>Montant ou volume</TH>
                <TH>Étape</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/admin/partenariats/contributions/${c.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {c.description}
                    </Link>
                    {c.agreement ? <span className="block text-caption text-ink-500">{c.agreement.reference}</span> : null}
                    {c.expected_on && c.expected_on < today && (c.stage === "pledged" || c.stage === "committed") ? (
                      <span className="block text-caption font-semibold text-danger-600">Attendue le {formatDate(c.expected_on)}</span>
                    ) : null}
                  </TD>
                  <TD>{c.organization?.name ?? "—"}</TD>
                  <TD>{CONTRIBUTION_KINDS[c.kind]}</TD>
                  <TD>{contributionAmount(c)}</TD>
                  <TD>
                    <Badge tone={CONTRIBUTION_STAGE[c.stage].tone}>{CONTRIBUTION_STAGE[c.stage].label}</Badge>
                  </TD>
                  <TD>{formatRelative(c.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
