import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import { SERVICE_PLANS, TENANT_STATUS, type TenantStatus } from "@/lib/enterprise";
import { requireEnterpriseStaff } from "@/server/auth";
import { listTenants } from "@/server/queries/enterprise";

export const metadata: Metadata = { title: "Espaces de formation — Enterprise" };

const TABS: Array<{ key: string; label: string; status?: TenantStatus }> = [
  { key: "tous", label: "Tous" },
  { key: "demandes", label: "À autoriser", status: "requested" },
  { key: "mise-en-place", label: "Mise en place", status: "provisioning" },
  { key: "actifs", label: "Actifs", status: "active" },
  { key: "suspendus", label: "Suspendus", status: "suspended" },
  { key: "fin", label: "Fin de contrat", status: "offboarding" },
  { key: "fermes", label: "Fermés", status: "closed" },
];

export default async function TenantsPage(props: PageProps<"/admin/partenariats/entreprises/espaces">) {
  await requireEnterpriseStaff();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0]!;
  const rows = await listTenants({ status: tab.status });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Espaces de formation entreprise"
        description="Un espace sécurisé par entreprise cliente : ses collaborateurs, ses formations, ses rapports. Créé seulement après un contrat signé et l’autorisation d’un approbateur."
      />
      <Alert tone="info" className="mb-4">
        Pour préparer un espace, ouvrez la fiche du client (contrat signé) et choisissez « Préparer l’espace de formation ».
      </Alert>
      <LinkTabs
        className="mb-4"
        activeHref={`/admin/partenariats/entreprises/espaces?onglet=${tab.key}`}
        items={TABS.map((t) => ({ href: `/admin/partenariats/entreprises/espaces?onglet=${t.key}`, label: t.label }))}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title="Aucun espace" description="Les espaces apparaissent ici dès qu’une création est demandée depuis une fiche client." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table caption="Espaces de formation entreprise">
            <THead>
              <TR>
                <TH>Espace</TH>
                <TH>Formule</TH>
                <TH>Statut</TH>
                <TH>Collaborateurs autorisés</TH>
                <TH>Fin du contrat</TH>
                <TH>Mise à jour</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <Link href={`/admin/partenariats/entreprises/espaces/${t.id}`} className="font-semibold text-ink-900 hover:text-accent-700 hover:underline">
                      {t.display_name}
                    </Link>
                    <span className="block text-caption text-ink-500">/entreprise/{t.slug}</span>
                  </TD>
                  <TD>{SERVICE_PLANS[t.service_plan]}</TD>
                  <TD>
                    <Badge tone={TENANT_STATUS[t.status].tone}>{TENANT_STATUS[t.status].label}</Badge>
                  </TD>
                  <TD>{t.max_learners}</TD>
                  <TD className={t.contract_end_on && t.contract_end_on < today && t.status === "active" ? "font-semibold text-danger-600" : undefined}>
                    {t.contract_end_on ? formatDate(t.contract_end_on) : "—"}
                  </TD>
                  <TD>{formatRelative(t.updated_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
