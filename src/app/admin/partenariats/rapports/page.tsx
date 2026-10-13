import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { REPORT_STATUS } from "@/lib/partnerships";
import { requirePartnershipStaff } from "@/server/auth";
import { listReports } from "@/server/queries/impact";

export const metadata: Metadata = { title: "Rapports aux partenaires" };

export default async function ReportsPage() {
  await requirePartnershipStaff();
  const rows = await listReports();
  return (
    <>
      <PageHeader title="Rapports aux partenaires" description="Rapports PDF construits à partir des seules données vérifiées : brouillon → approbation (approbateur) → transmission." />
      <Alert tone="info" className="mb-4">
        Un rapport se crée depuis la fiche de l’organisation partenaire. Il ne contient que des chiffres agrégés : aucun élève ni enseignant n’y est nommé.
      </Alert>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="Aucun rapport" description="Les rapports aux partenaires apparaissent ici." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Rapports aux partenaires">
            <THead>
              <TR>
                <TH>Rapport</TH>
                <TH>Partenaire</TH>
                <TH>Période</TH>
                <TH>Statut</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/admin/partenariats/rapports/${r.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {r.title}
                    </Link>
                    <span className="block text-caption text-ink-500">{r.reference}</span>
                  </TD>
                  <TD>{r.organization?.name ?? "—"}</TD>
                  <TD>
                    {formatDate(r.period_start)} → {formatDate(r.period_end)}
                  </TD>
                  <TD>
                    <Badge tone={REPORT_STATUS[r.status].tone}>{REPORT_STATUS[r.status].label}</Badge>
                  </TD>
                  <TD>{formatRelative(r.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
