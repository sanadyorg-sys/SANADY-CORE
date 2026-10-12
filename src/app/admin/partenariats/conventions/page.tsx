import type { Metadata } from "next";
import Link from "next/link";
import { FilePenLine } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { AGREEMENT_STATUS, INTERVENTION_FIELDS, type AgreementStatus } from "@/lib/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { listAgreements } from "@/server/queries/agreements";

export const metadata: Metadata = { title: "Conventions de partenariat" };

const TABS: Array<{ key: string; label: string; status?: AgreementStatus }> = [
  { key: "toutes", label: "Toutes" },
  { key: "brouillons", label: "Brouillons", status: "draft" },
  { key: "revue", label: "En revue", status: "internal_review" },
  { key: "a-signer", label: "À signer", status: "approved" },
  { key: "signees", label: "Signées", status: "signed" },
  { key: "en-cours", label: "En cours", status: "active" },
  { key: "terminees", label: "Terminées", status: "completed" },
  { key: "archivees", label: "Archivées", status: "archived" },
];

export default async function AgreementsPage(props: PageProps<"/admin/partenariats/conventions">) {
  await requirePartnershipStaff();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0]!;
  const rows = await listAgreements({ status: tab.status });
  const today = new Date();

  return (
    <>
      <PageHeader
        title="Conventions de partenariat"
        description="Brouillon → revue interne → approbation (approbateur) → signature enregistrée avec l’exemplaire signé → mise en œuvre → clôture."
      />
      <Alert tone="info" className="mb-4">
        Une convention se prépare depuis la fiche de l’organisation partenaire. La plateforme ne produit jamais de signature : elle conserve
        l’exemplaire signé et la date.
      </Alert>
      <LinkTabs className="mb-4" activeHref={`/admin/partenariats/conventions?onglet=${tab.key}`} items={TABS.map((t) => ({ href: `/admin/partenariats/conventions?onglet=${t.key}`, label: t.label }))} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={FilePenLine} title="Aucune convention" description="Les conventions apparaissent ici dès leur premier brouillon." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Conventions de partenariat">
            <THead>
              <TR>
                <TH>Convention</TH>
                <TH>Partenaire</TH>
                <TH>Domaine</TH>
                <TH>Statut</TH>
                <TH>Période</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((a) => {
                const renewal =
                  (a.status === "signed" || a.status === "active") && a.end_on && new Date(a.end_on).getTime() - a.renewal_notice_days * 86400000 <= today.getTime();
                return (
                  <TR key={a.id}>
                    <TD>
                      <Link href={`/admin/partenariats/conventions/${a.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                        {a.title}
                      </Link>
                      <span className="block text-caption text-ink-500">{a.reference}</span>
                    </TD>
                    <TD>{a.organization?.name ?? "—"}</TD>
                    <TD>{INTERVENTION_FIELDS[a.intervention_field]?.name ?? a.intervention_field}</TD>
                    <TD>
                      <Badge tone={AGREEMENT_STATUS[a.status].tone}>{AGREEMENT_STATUS[a.status].label}</Badge>
                    </TD>
                    <TD className={renewal ? "font-semibold text-warning-700" : undefined}>
                      {a.start_on && a.end_on ? `${formatDate(a.start_on)} → ${formatDate(a.end_on)}` : "—"}
                      {renewal ? <span className="block text-caption">Renouvellement à préparer</span> : null}
                    </TD>
                    <TD>{formatRelative(a.updated_at)}</TD>
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
